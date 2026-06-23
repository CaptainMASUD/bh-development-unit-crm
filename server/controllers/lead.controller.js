import mongoose from "mongoose";
import Lead from "../models/lead.model.js";
import Customer from "../models/customer.model.js";
import PurchaseType from "../models/purchaseType.model.js";
import Activity from "../models/activity.model.js";
import ActivityLog from "../models/activityLog.model.js";
import Proposal from "../models/proposal.model.js";
import Deal from "../models/deal.model.js";
import WorkQueue from "../models/workQueue.model.js";
import Notification from "../models/notification.model.js";

import { dashboardCache } from "../utils/cache.js";
import {
  getReqMeta,
  writeAudit,
  writeActivity,
  writeConversionLog,
} from "../utils/audit.js";
import { verifyAdminPassword } from "../utils/verifyAdminPassword.js";

const invalidateDashboardCache = () => {
  try {
    const keys = dashboardCache.keys?.() || [];
    for (const k of keys) {
      if (String(k).startsWith("dashboard:v1:")) dashboardCache.del(k);
    }
  } catch {
    try {
      dashboardCache.flushAll?.();
    } catch {}
  }
};

const toObjectId = (v) => {
  if (!v) return null;
  return mongoose.Types.ObjectId.isValid(v)
    ? new mongoose.Types.ObjectId(v)
    : null;
};

const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

const normalizeString = (value = "") => String(value || "").trim();

const normalizeLower = (value = "") => normalizeString(value).toLowerCase();

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

const buildLeadAccessMatch = (req) => {
  if (isAdminOrSuperAdmin(req)) return {};

  const me = new mongoose.Types.ObjectId(req.user._id);

  return {
    $or: [
      { assignedTo: me },
      { allowedUsers: me },
      { createdBy: me, ownerLocked: false },
    ],
  };
};

const assertLeadAccessOrThrow = async ({ req, leadId, session = null }) => {
  if (isAdminOrSuperAdmin(req)) return true;

  const me = new mongoose.Types.ObjectId(req.user._id);

  const q = {
    _id: leadId,
    $or: [
      { assignedTo: me },
      { allowedUsers: me },
      { createdBy: me, ownerLocked: false },
    ],
  };

  const exists = session
    ? await Lead.exists(q).session(session)
    : await Lead.exists(q);

  if (!exists) {
    const err = new Error("Not authorized to access this lead");
    err.statusCode = 403;
    throw err;
  }

  return true;
};

const applyCursor = (filter, cursor) => {
  const c = toObjectId(cursor);
  if (c) filter._id = { ...(filter._id || {}), $lt: c };
};

const LEAD_STATUSES = ["new", "contacted", "pending", "confirmed", "lost"];

const PIPELINE_STAGES = [
  "new",
  "qualified",
  "discovery",
  "proposal",
  "negotiation",
  "won",
  "lost",
];

const PRIORITIES = ["low", "medium", "high"];

const LEAD_TEMPERATURES = ["cold", "warm", "hot"];

const WORK_QUEUE_PRIORITIES = ["low", "normal", "high", "urgent"];

const validatePurchaseTypeOrThrow = async (purchaseType) => {
  const pt = normalizeString(purchaseType);
  if (!pt) return "";

  const exists = await PurchaseType.exists({
    isActive: true,
    $or: [{ key: pt.toLowerCase() }, { name: pt }],
  });

  if (!exists) {
    const err = new Error("Invalid purchaseType");
    err.statusCode = 400;
    throw err;
  }

  return pt;
};

const pushStageNote = ({
  note,
  type = "general",
  oldStage = "",
  newStage = "",
  oldStatus = "",
  newStatus = "",
  reason = "",
  userId,
}) => ({
  note: normalizeString(note || reason || "Lead updated"),
  type,
  oldStage,
  newStage,
  oldStatus,
  newStatus,
  reason: normalizeString(reason),
  createdBy: userId,
  createdAt: new Date(),
});

const calculateLeadScore = ({
  leadScore = 0,
  priority = "medium",
  leadTemperature = "warm",
  expectedValue = 0,
  pipelineStage = "new",
  nextFollowUpAt = null,
  lastContactedAt = null,
}) => {
  let score = clamp(Number(leadScore || 0), 0, 100);

  if (priority === "high") score += 20;
  if (priority === "medium") score += 10;

  if (leadTemperature === "hot") score += 25;
  if (leadTemperature === "warm") score += 10;

  if (Number(expectedValue || 0) >= 100000) score += 25;
  else if (Number(expectedValue || 0) >= 50000) score += 15;
  else if (Number(expectedValue || 0) >= 10000) score += 8;

  if (["proposal", "negotiation"].includes(pipelineStage)) score += 25;
  if (pipelineStage === "qualified") score += 12;
  if (pipelineStage === "discovery") score += 15;

  const now = new Date();

  if (nextFollowUpAt) {
    const fu = new Date(nextFollowUpAt);
    if (!Number.isNaN(fu.getTime())) {
      if (fu < now) score += 30;
      else if (fu.getTime() - now.getTime() <= 24 * 60 * 60 * 1000) score += 15;
    }
  }

  if (!lastContactedAt) score += 10;

  return clamp(score, 0, 1000);
};

const getQueuePriorityFromScore = (score) => {
  if (score >= 120) return "urgent";
  if (score >= 85) return "high";
  if (score >= 45) return "normal";
  return "low";
};

const getSuggestedAction = ({ pipelineStage, status, nextFollowUpAt, lastContactedAt }) => {
  if (pipelineStage === "won") {
    return {
      nextAction: "Convert this won lead to customer",
      nextActionType: "convert",
    };
  }

  if (pipelineStage === "lost" || status === "lost") {
    return {
      nextAction: "Review lost reason",
      nextActionType: "lost_review",
    };
  }

  if (!lastContactedAt) {
    return {
      nextAction: "Call this lead for first contact",
      nextActionType: "call",
    };
  }

  if (nextFollowUpAt && new Date(nextFollowUpAt) <= new Date()) {
    return {
      nextAction: "Follow up with this lead",
      nextActionType: "follow_up",
    };
  }

  if (pipelineStage === "new") {
    return {
      nextAction: "Qualify this lead",
      nextActionType: "call",
    };
  }

  if (pipelineStage === "qualified") {
    return {
      nextAction: "Collect requirement details",
      nextActionType: "meeting",
    };
  }

  if (pipelineStage === "discovery") {
    return {
      nextAction: "Create or send proposal",
      nextActionType: "proposal",
    };
  }

  if (pipelineStage === "proposal") {
    return {
      nextAction: "Follow up about proposal",
      nextActionType: "follow_up",
    };
  }

  if (pipelineStage === "negotiation") {
    return {
      nextAction: "Close deal or update negotiation status",
      nextActionType: "deal",
    };
  }

  return {
    nextAction: "Review lead",
    nextActionType: "follow_up",
  };
};

const buildLeadAutomationSet = ({
  leadScore = 0,
  priority = "medium",
  leadTemperature = "warm",
  expectedValue = 0,
  pipelineStage = "new",
  status = "new",
  nextFollowUpAt = null,
  lastContactedAt = null,
}) => {
  const score = calculateLeadScore({
    leadScore,
    priority,
    leadTemperature,
    expectedValue,
    pipelineStage,
    nextFollowUpAt,
    lastContactedAt,
  });

  const queuePriority = getQueuePriorityFromScore(score);
  const suggestion = getSuggestedAction({
    pipelineStage,
    status,
    nextFollowUpAt,
    lastContactedAt,
  });

  const now = new Date();
  const followUpDate = validateDateOrNull(nextFollowUpAt);
  const isOverdue =
    Boolean(followUpDate) &&
    followUpDate < now &&
    !["won", "lost"].includes(pipelineStage);

  return {
    leadScore: clamp(Number(leadScore || 0), 0, 100),
    workQueueScore: score,
    workQueuePriority: queuePriority,
    nextAction: suggestion.nextAction,
    nextActionType: suggestion.nextActionType,
    nextActionAt: followUpDate,
    isOverdue,
    overdueSince: isOverdue ? followUpDate : null,
    "automationFlags.needsFirstContact": !lastContactedAt && pipelineStage !== "lost",
    "automationFlags.needsFollowUp": isOverdue,
    "automationFlags.proposalFollowUpDue": pipelineStage === "proposal" && isOverdue,
    "automationFlags.dealStuck": pipelineStage === "negotiation" && isOverdue,
  };
};

const getStartOfDay = (date = new Date()) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

const createOrUpdateLeadQueue = async ({
  lead,
  assignedTo,
  source = "manual",
  title = "",
  description = "",
  recommendedAction = "review",
  priority = "normal",
  priorityScore = 0,
  dueAt = null,
  createdBy = null,
  session = null,
}) => {
  try {
    if (!lead?._id || !assignedTo) return null;

    const queueDate = getStartOfDay(dueAt || new Date());

    const filter = {
      leadId: lead._id,
      assignedTo,
      status: { $in: ["pending", "in_progress", "snoozed"] },
      source,
    };

    const update = {
      $set: {
        queueDate,
        customerId: lead.customerId || null,
        title: title || lead.nextAction || "Review lead",
        description,
        recommendedAction,
        priority,
        priorityScore,
        dueAt,
        createdBy,
        autoGenerated: true,
      },
      $setOnInsert: {
        leadId: lead._id,
        status: "pending",
      },
    };

    const options = {
      new: true,
      upsert: true,
      runValidators: true,
      ...(session ? { session } : {}),
    };

    return await WorkQueue.findOneAndUpdate(filter, update, options);
  } catch (err) {
    console.error("Lead queue create/update failed:", err.message);
    return null;
  }
};

const createNotificationSafe = async ({
  userId,
  title,
  message,
  type = "lead",
  priority = "normal",
  entityType = "Lead",
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

const ALLOWED_LIST_FIELDS = new Set([
  "leadNumber",
  "contact",
  "contact.name",
  "contact.email",
  "contact.phone",
  "contact.companyName",
  "status",
  "pipelineStage",
  "priority",
  "leadTemperature",
  "leadScore",
  "workQueuePriority",
  "workQueueScore",
  "lastActivityAt",
  "nextAction",
  "nextActionType",
  "nextActionAt",
  "isOverdue",
  "overdueSince",
  "purchaseType",
  "source",
  "company",
  "requirement",
  "tags",
  "assignedTo",
  "createdBy",
  "lastContactedAt",
  "nextFollowUpAt",
  "lostReason",
  "lostAt",
  "wonReason",
  "wonAt",
  "customerId",
  "convertedCustomer",
  "convertedAt",
  "createdAt",
  "updatedAt",
]);

const ALWAYS_INCLUDE_FOR_LIST = {
  _id: 1,
  status: 1,
  pipelineStage: 1,
  "contact.name": 1,
  "contact.companyName": 1,
  priority: 1,
  leadTemperature: 1,
  leadScore: 1,
  workQueuePriority: 1,
  workQueueScore: 1,
  nextAction: 1,
  nextActionType: 1,
  nextActionAt: 1,
  isOverdue: 1,
  nextFollowUpAt: 1,
  lastContactedAt: 1,
  customerId: 1,
  convertedCustomer: 1,
};

const parseFieldsProjection = (fieldsRaw) => {
  if (!fieldsRaw) return null;

  const parts = String(fieldsRaw)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (!parts.length) return null;

  const proj = {};

  for (const f of parts) {
    if (ALLOWED_LIST_FIELDS.has(f)) proj[f] = 1;
  }

  return { ...proj, ...ALWAYS_INCLUDE_FOR_LIST };
};

/* =======================
   CREATE LEAD
======================= */
export const createLead = async (req, res) => {
  try {
    const meta = getReqMeta(req);

    const {
      contact,
      source,
      tags,
      assignedTo,
      company,
      priority,
      purchaseType,
      leadTemperature,
      leadScore,
      requirement,
      nextFollowUpAt,
    } = req.body || {};

    if (!contact?.name || !contact?.companyName) {
      return res.status(400).json({
        message: "contact.name and contact.companyName are required.",
      });
    }

    const safePriority = PRIORITIES.includes(normalizeLower(priority))
      ? normalizeLower(priority)
      : "medium";

    const safeTemperature = LEAD_TEMPERATURES.includes(normalizeLower(leadTemperature))
      ? normalizeLower(leadTemperature)
      : "warm";

    const safeScore = clamp(Number(leadScore || 0), 0, 100);
    const safePurchaseType = await validatePurchaseTypeOrThrow(purchaseType);
    const assignedUserId = toObjectId(assignedTo) || req.user._id;
    const followUpDate = validateDateOrNull(nextFollowUpAt);

    const automationSet = buildLeadAutomationSet({
      leadScore: safeScore,
      priority: safePriority,
      leadTemperature: safeTemperature,
      expectedValue: requirement?.expectedValue || 0,
      pipelineStage: "new",
      status: "new",
      nextFollowUpAt: followUpDate,
      lastContactedAt: null,
    });

    const doc = await Lead.create({
      contact: {
        name: normalizeString(contact.name),
        email: normalizeLower(contact.email),
        phone: normalizeString(contact.phone),
        companyName: normalizeString(contact.companyName),
      },

      source: normalizeString(source),

      tags: Array.isArray(tags)
        ? tags.map((t) => normalizeString(t)).filter(Boolean)
        : [],

      company: {
        website: normalizeString(company?.website),
        industry: normalizeString(company?.industry),
        address: normalizeString(company?.address),
      },

      priority: safePriority,
      leadTemperature: safeTemperature,
      leadScore: safeScore,
      purchaseType: safePurchaseType,

      requirement: {
        summary: normalizeString(requirement?.summary),
        painPoints: Array.isArray(requirement?.painPoints)
          ? requirement.painPoints.map((p) => normalizeString(p)).filter(Boolean)
          : [],
        expectedSolution: normalizeString(requirement?.expectedSolution),
        budgetMin: Math.max(Number(requirement?.budgetMin || 0), 0),
        budgetMax: Math.max(Number(requirement?.budgetMax || 0), 0),
        expectedValue: Math.max(Number(requirement?.expectedValue || 0), 0),
        timeline: normalizeString(requirement?.timeline),
        decisionMaker: normalizeString(requirement?.decisionMaker),
      },

      lastContactedAt: null,
      nextFollowUpAt: followUpDate,

      ...automationSet,

      createdBy: req.user._id,
      assignedTo: assignedUserId,

      ownerLocked: false,
      allowedUsers: [],
    });

    await createOrUpdateLeadQueue({
      lead: doc,
      assignedTo: assignedUserId,
      source: "new_lead",
      title: doc.nextAction || "New lead needs first contact",
      description: `${doc.contact?.name || "Lead"} from ${doc.contact?.companyName || "company"}`,
      recommendedAction: doc.nextActionType === "call" ? "call" : "review",
      priority: doc.workQueuePriority,
      priorityScore: doc.workQueueScore,
      dueAt: followUpDate || new Date(),
      createdBy: req.user._id,
    });

    await createNotificationSafe({
      userId: assignedUserId,
      title: "New lead assigned",
      message: `${doc.contact?.name} from ${doc.contact?.companyName}`,
      priority: doc.workQueuePriority,
      entityId: doc._id,
      createdBy: req.user._id,
    });

    await writeAudit({
      actorId: req.user._id,
      action: "create",
      entityType: "Lead",
      entityId: doc._id,
      before: null,
      after: doc.toObject(),
      meta,
    });

    await writeActivity({
      leadId: doc._id,
      entityType: "Lead",
      entityId: doc._id,
      type: "created",
      message: "Lead created",
      createdBy: req.user._id,
    });

    invalidateDashboardCache();

    return res.status(201).json({
      message: "Lead created",
      lead: doc,
    });
  } catch (err) {
    const code = err.statusCode || 500;

    return res.status(code).json({
      message: err.statusCode ? err.message : "Failed to create lead",
      error: err.message,
    });
  }
};

/* =======================
   LIST LEADS
======================= */
export const listLeads = async (req, res) => {
  try {
    const {
      status,
      pipelineStage,
      priority,
      leadTemperature,
      purchaseType,
      source,
      assignedTo,
      createdBy,
      tag,
      q,
      nextFollowUpFrom,
      nextFollowUpTo,
      lastContactedFrom,
      lastContactedTo,
      isOverdue,
      workQueuePriority,
      nextActionType,
      cursor,
      limit,
      fields,
      sort,
    } = req.query;

    const pageSize = clamp(parseInt(limit || "20", 10), 1, 100);

    const filter = { ...buildLeadAccessMatch(req) };

    if (status && LEAD_STATUSES.includes(String(status))) filter.status = status;

    if (pipelineStage && PIPELINE_STAGES.includes(String(pipelineStage))) {
      filter.pipelineStage = pipelineStage;
    }

    if (source) filter.source = normalizeString(source);

    if (priority && PRIORITIES.includes(normalizeLower(priority))) {
      filter.priority = normalizeLower(priority);
    }

    if (
      leadTemperature &&
      LEAD_TEMPERATURES.includes(normalizeLower(leadTemperature))
    ) {
      filter.leadTemperature = normalizeLower(leadTemperature);
    }

    if (purchaseType) filter.purchaseType = normalizeString(purchaseType);

    if (workQueuePriority && WORK_QUEUE_PRIORITIES.includes(String(workQueuePriority))) {
      filter.workQueuePriority = workQueuePriority;
    }

    if (nextActionType) filter.nextActionType = normalizeString(nextActionType);

    if (String(isOverdue || "").toLowerCase() === "true") filter.isOverdue = true;
    if (String(isOverdue || "").toLowerCase() === "false") filter.isOverdue = false;

    const assignedId = toObjectId(assignedTo);
    if (assignedId) filter.assignedTo = assignedId;

    const createdId = toObjectId(createdBy);
    if (createdId) filter.createdBy = createdId;

    if (tag) filter.tags = normalizeString(tag);

    if (nextFollowUpFrom || nextFollowUpTo) {
      filter.nextFollowUpAt = {};
      const from = validateDateOrNull(nextFollowUpFrom);
      const to = validateDateOrNull(nextFollowUpTo);
      if (from) filter.nextFollowUpAt.$gte = from;
      if (to) filter.nextFollowUpAt.$lte = to;
    }

    if (lastContactedFrom || lastContactedTo) {
      filter.lastContactedAt = {};
      const from = validateDateOrNull(lastContactedFrom);
      const to = validateDateOrNull(lastContactedTo);
      if (from) filter.lastContactedAt.$gte = from;
      if (to) filter.lastContactedAt.$lte = to;
    }

    if (cursor) applyCursor(filter, cursor);

    const dynamicProjection = parseFieldsProjection(fields);

    const defaultProjection = {
      leadNumber: 1,
      contact: 1,
      status: 1,
      pipelineStage: 1,
      priority: 1,
      leadTemperature: 1,
      leadScore: 1,
      workQueuePriority: 1,
      workQueueScore: 1,
      lastActivityAt: 1,
      nextAction: 1,
      nextActionType: 1,
      nextActionAt: 1,
      isOverdue: 1,
      overdueSince: 1,
      purchaseType: 1,
      source: 1,
      tags: 1,
      assignedTo: 1,
      createdBy: 1,
      lastContactedAt: 1,
      nextFollowUpAt: 1,
      lostReason: 1,
      lostAt: 1,
      wonReason: 1,
      wonAt: 1,
      customerId: 1,
      convertedCustomer: 1,
      convertedAt: 1,
      createdAt: 1,
      updatedAt: 1,
      _id: 1,
    };

    const projection = dynamicProjection || defaultProjection;

    let query = Lead.find(filter).select(projection).lean();

    if (q && normalizeString(q) && sort !== "newest") {
      query = query
        .find({ ...filter, $text: { $search: normalizeString(q) } })
        .select({ ...projection, score: { $meta: "textScore" } })
        .sort({ score: { $meta: "textScore" }, workQueueScore: -1, _id: -1 });
    } else if (q && normalizeString(q)) {
      query = query
        .find({ ...filter, $text: { $search: normalizeString(q) } })
        .sort({ createdAt: -1, _id: -1 });
    } else if (sort === "newest") {
      query = query.sort({ createdAt: -1, _id: -1 });
    } else {
      query = query.sort({ workQueueScore: -1, nextActionAt: 1, _id: -1 });
    }

    const rows = await query.limit(pageSize + 1);

    const hasNextPage = rows.length > pageSize;
    const items = hasNextPage ? rows.slice(0, pageSize) : rows;
    const nextCursor = hasNextPage ? String(items[items.length - 1]._id) : null;

    return res.json({
      items,
      pageInfo: {
        limit: pageSize,
        hasNextPage,
        nextCursor,
      },
    });
  } catch (err) {
    return res.status(500).json({
      message: "Failed to list leads",
      error: err.message,
    });
  }
};

/* =======================
   GET LEAD
======================= */
export const getLeadById = async (req, res) => {
  try {
    const id = toObjectId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid lead id" });

    await assertLeadAccessOrThrow({ req, leadId: id });

    const lead = await Lead.findById(id)
      .populate("assignedTo", "name email role avatarUrl teamRole workStatus")
      .populate("createdBy", "name email role avatarUrl")
      .populate("allowedUsers", "name email role avatarUrl")
      .lean();

    if (!lead) return res.status(404).json({ message: "Lead not found" });

    return res.json({ lead });
  } catch (err) {
    const code = err.statusCode || 500;

    return res.status(code).json({
      message: err.statusCode ? err.message : "Failed to get lead",
      error: err.message,
    });
  }
};

/* =======================
   UPDATE LEAD BASIC INFO
======================= */
export const updateLead = async (req, res) => {
  try {
    const meta = getReqMeta(req);

    const id = toObjectId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid lead id" });

    await assertLeadAccessOrThrow({ req, leadId: id });

    const before = await Lead.findById(id).lean();
    if (!before) return res.status(404).json({ message: "Lead not found" });

    const set = {};

    if (req.body?.source !== undefined) set.source = normalizeString(req.body.source);

    if (req.body?.priority !== undefined) {
      const pr = normalizeLower(req.body.priority);
      if (!PRIORITIES.includes(pr)) {
        return res.status(400).json({
          message: "Invalid priority. Use: low, medium, high.",
        });
      }
      set.priority = pr;
    }

    if (req.body?.leadTemperature !== undefined) {
      const temp = normalizeLower(req.body.leadTemperature);
      if (!LEAD_TEMPERATURES.includes(temp)) {
        return res.status(400).json({
          message: "Invalid leadTemperature. Use: cold, warm, hot.",
        });
      }
      set.leadTemperature = temp;
    }

    if (req.body?.leadScore !== undefined) {
      set.leadScore = clamp(Number(req.body.leadScore || 0), 0, 100);
    }

    if (req.body?.purchaseType !== undefined) {
      set.purchaseType = await validatePurchaseTypeOrThrow(req.body.purchaseType);
    }

    if (req.body?.tags !== undefined) {
      set.tags = Array.isArray(req.body.tags)
        ? req.body.tags.map((t) => normalizeString(t)).filter(Boolean)
        : [];
    }

    if (req.body?.assignedTo !== undefined) {
      const aid = toObjectId(req.body.assignedTo);
      if (!aid) return res.status(400).json({ message: "Invalid assignedTo id" });
      set.assignedTo = aid;
    }

    if (req.body?.lastContactedAt !== undefined) {
      set.lastContactedAt = validateDateOrNull(req.body.lastContactedAt);
    }

    if (req.body?.nextFollowUpAt !== undefined) {
      set.nextFollowUpAt = validateDateOrNull(req.body.nextFollowUpAt);
    }

    const contact = req.body?.contact || {};
    if (contact.name !== undefined) set["contact.name"] = normalizeString(contact.name);
    if (contact.email !== undefined) set["contact.email"] = normalizeLower(contact.email);
    if (contact.phone !== undefined) set["contact.phone"] = normalizeString(contact.phone);
    if (contact.companyName !== undefined) {
      set["contact.companyName"] = normalizeString(contact.companyName);
    }

    const company = req.body?.company || {};
    if (company.website !== undefined) set["company.website"] = normalizeString(company.website);
    if (company.industry !== undefined) set["company.industry"] = normalizeString(company.industry);
    if (company.address !== undefined) set["company.address"] = normalizeString(company.address);

    const nextPriority = set.priority ?? before.priority;
    const nextTemp = set.leadTemperature ?? before.leadTemperature;
    const nextScore = set.leadScore ?? before.leadScore;
    const nextFollowUpAt = set.nextFollowUpAt ?? before.nextFollowUpAt;
    const nextLastContactedAt = set.lastContactedAt ?? before.lastContactedAt;
    const expectedValue =
      before.requirement?.expectedValue ||
      req.body?.requirement?.expectedValue ||
      0;

    Object.assign(
      set,
      buildLeadAutomationSet({
        leadScore: nextScore,
        priority: nextPriority,
        leadTemperature: nextTemp,
        expectedValue,
        pipelineStage: before.pipelineStage,
        status: before.status,
        nextFollowUpAt,
        lastContactedAt: nextLastContactedAt,
      })
    );

    if (!Object.keys(set).length) {
      return res.status(400).json({ message: "No valid fields provided." });
    }

    const lead = await Lead.findByIdAndUpdate(
      id,
      { $set: set },
      { new: true, runValidators: true }
    );

    if (String(before.assignedTo || "") !== String(lead.assignedTo || "")) {
      await createOrUpdateLeadQueue({
        lead,
        assignedTo: lead.assignedTo,
        source: "manual",
        title: lead.nextAction || "Review reassigned lead",
        description: "Lead was assigned/reassigned",
        recommendedAction: lead.nextActionType === "call" ? "call" : "review",
        priority: lead.workQueuePriority,
        priorityScore: lead.workQueueScore,
        dueAt: lead.nextActionAt || lead.nextFollowUpAt || new Date(),
        createdBy: req.user._id,
      });

      await createNotificationSafe({
        userId: lead.assignedTo,
        title: "Lead assigned to you",
        message: `${lead.contact?.name || "Lead"} from ${lead.contact?.companyName || "company"}`,
        priority: lead.workQueuePriority,
        entityId: lead._id,
        createdBy: req.user._id,
      });
    }

    await writeAudit({
      actorId: req.user._id,
      action: "update",
      entityType: "Lead",
      entityId: id,
      before,
      after: lead.toObject(),
      meta,
    });

    await writeActivity({
      leadId: id,
      entityType: "Lead",
      entityId: id,
      type: "updated",
      message: "Lead updated",
      createdBy: req.user._id,
      meta: {
        fields: Object.keys(set),
      },
    });

    invalidateDashboardCache();

    return res.json({
      message: "Lead updated",
      lead,
    });
  } catch (err) {
    const code = err.statusCode || 500;

    return res.status(code).json({
      message: err.statusCode ? err.message : "Failed to update lead",
      error: err.message,
    });
  }
};

/* =======================
   ADD LEAD NOTE
======================= */
export const addLeadNote = async (req, res) => {
  try {
    const meta = getReqMeta(req);

    const id = toObjectId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid lead id" });

    await assertLeadAccessOrThrow({ req, leadId: id });

    const before = await Lead.findById(id).lean();
    if (!before) return res.status(404).json({ message: "Lead not found" });

    const {
      note,
      type = "general",
      reason = "",
    } = req.body || {};

    if (!note || !normalizeString(note)) {
      return res.status(400).json({ message: "note is required" });
    }

    const lead = await Lead.findByIdAndUpdate(
      id,
      {
        $push: {
          notes: pushStageNote({
            note,
            type,
            oldStage: before.pipelineStage || "",
            newStage: before.pipelineStage || "",
            oldStatus: before.status || "",
            newStatus: before.status || "",
            reason,
            userId: req.user._id,
          }),
        },
      },
      { new: true, runValidators: true }
    );

    await writeAudit({
      actorId: req.user._id,
      action: "update",
      entityType: "Lead",
      entityId: id,
      before,
      after: lead.toObject(),
      meta,
    });

    await writeActivity({
      leadId: id,
      entityType: "Lead",
      entityId: id,
      type: "note_added",
      message: "Lead note added",
      createdBy: req.user._id,
      meta: { noteType: type, reason },
    });

    return res.status(201).json({
      message: "Note added",
      lead,
    });
  } catch (err) {
    const code = err.statusCode || 500;

    return res.status(code).json({
      message: err.statusCode ? err.message : "Failed to add note",
      error: err.message,
    });
  }
};

/* =======================
   UPDATE LEAD STAGE
======================= */
export const updateLeadStage = async (req, res) => {
  try {
    const meta = getReqMeta(req);

    const id = toObjectId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid lead id" });

    await assertLeadAccessOrThrow({ req, leadId: id });

    const before = await Lead.findById(id).lean();
    if (!before) return res.status(404).json({ message: "Lead not found" });

    const {
      pipelineStage,
      status,
      reason,
      note = "",
      nextFollowUpAt,
    } = req.body || {};

    if (!pipelineStage || !PIPELINE_STAGES.includes(String(pipelineStage))) {
      return res.status(400).json({
        message: `Invalid pipelineStage. Use: ${PIPELINE_STAGES.join(", ")}`,
      });
    }

    if (!reason || !normalizeString(reason)) {
      return res.status(400).json({ message: "reason is required" });
    }

    if (pipelineStage === "negotiation") {
      return res.status(400).json({
        message: "Negotiation starts automatically when a deal is created from a sent or accepted proposal.",
      });
    }

    if (pipelineStage === "won") {
      return res.status(400).json({
        message: "A lead can only become won by winning its linked deal.",
      });
    }

    const set = {
      pipelineStage,
    };

    if (status !== undefined && status !== "") {
      if (!LEAD_STATUSES.includes(String(status))) {
        return res.status(400).json({
          message: `Invalid status. Use: ${LEAD_STATUSES.join(", ")}`,
        });
      }
      set.status = status;
    }

    const followUpDate = validateDateOrNull(nextFollowUpAt);
    if (nextFollowUpAt !== undefined) {
      if (!followUpDate) return res.status(400).json({ message: "Invalid nextFollowUpAt date" });
      set.nextFollowUpAt = followUpDate;
    }

    if (pipelineStage === "lost") {
      set.status = "lost";
      set.lostReason = normalizeString(reason);
      set.lostAt = new Date();
    }

    if (pipelineStage === "won") {
      set.status = "confirmed";
      set.wonReason = normalizeString(reason);
      set.wonAt = new Date();
    }

    Object.assign(
      set,
      buildLeadAutomationSet({
        leadScore: before.leadScore,
        priority: before.priority,
        leadTemperature: before.leadTemperature,
        expectedValue: before.requirement?.expectedValue || 0,
        pipelineStage,
        status: set.status || before.status,
        nextFollowUpAt: set.nextFollowUpAt || before.nextFollowUpAt,
        lastContactedAt: before.lastContactedAt,
      })
    );

    const lead = await Lead.findByIdAndUpdate(
      id,
      {
        $set: set,
        $push: {
          notes: pushStageNote({
            note: note || reason,
            type:
              pipelineStage === "lost"
                ? "lost_reason"
                : pipelineStage === "won"
                ? "won_reason"
                : "stage_change",
            oldStage: before.pipelineStage || "",
            newStage: pipelineStage,
            oldStatus: before.status || "",
            newStatus: set.status || before.status || "",
            reason,
            userId: req.user._id,
          }),
        },
      },
      { new: true, runValidators: true }
    );

    if (!["won", "lost"].includes(pipelineStage)) {
      await createOrUpdateLeadQueue({
        lead,
        assignedTo: lead.assignedTo,
        source: lead.isOverdue ? "overdue_follow_up" : "manual",
        title: lead.nextAction || `Lead moved to ${pipelineStage}`,
        description: reason,
        recommendedAction:
          lead.nextActionType === "proposal"
            ? "send_proposal"
            : lead.nextActionType === "deal"
            ? "create_deal"
            : lead.nextActionType === "call"
            ? "call"
            : "follow_up",
        priority: lead.workQueuePriority,
        priorityScore: lead.workQueueScore,
        dueAt: lead.nextActionAt || lead.nextFollowUpAt || new Date(),
        createdBy: req.user._id,
      });
    }

    await writeAudit({
      actorId: req.user._id,
      action: "stage_change",
      entityType: "Lead",
      entityId: id,
      before,
      after: lead.toObject(),
      meta,
    });

    await writeActivity({
      leadId: id,
      entityType: "Lead",
      entityId: id,
      type: "stage_changed",
      message: `Lead moved from ${before.pipelineStage} to ${pipelineStage}`,
      createdBy: req.user._id,
      meta: {
        oldStage: before.pipelineStage,
        newStage: pipelineStage,
        oldStatus: before.status,
        newStatus: set.status || before.status,
        reason,
      },
    });

    invalidateDashboardCache();

    return res.json({
      message: "Lead stage updated",
      lead,
    });
  } catch (err) {
    const code = err.statusCode || 500;

    return res.status(code).json({
      message: err.statusCode ? err.message : "Failed to update lead stage",
      error: err.message,
    });
  }
};

/* =======================
   UPDATE REQUIREMENT / DISCOVERY
======================= */
export const updateLeadRequirement = async (req, res) => {
  try {
    const meta = getReqMeta(req);

    const id = toObjectId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid lead id" });

    await assertLeadAccessOrThrow({ req, leadId: id });

    const before = await Lead.findById(id).lean();
    if (!before) return res.status(404).json({ message: "Lead not found" });

    const {
      summary,
      painPoints,
      expectedSolution,
      budgetMin,
      budgetMax,
      expectedValue,
      timeline,
      decisionMaker,
      note,
    } = req.body || {};

    const set = {};

    if (summary !== undefined) set["requirement.summary"] = normalizeString(summary);

    if (painPoints !== undefined) {
      set["requirement.painPoints"] = Array.isArray(painPoints)
        ? painPoints.map((p) => normalizeString(p)).filter(Boolean)
        : [];
    }

    if (expectedSolution !== undefined) {
      set["requirement.expectedSolution"] = normalizeString(expectedSolution);
    }

    if (budgetMin !== undefined) {
      set["requirement.budgetMin"] = Math.max(Number(budgetMin || 0), 0);
    }

    if (budgetMax !== undefined) {
      set["requirement.budgetMax"] = Math.max(Number(budgetMax || 0), 0);
    }

    if (expectedValue !== undefined) {
      set["requirement.expectedValue"] = Math.max(Number(expectedValue || 0), 0);
    }

    if (timeline !== undefined) set["requirement.timeline"] = normalizeString(timeline);
    if (decisionMaker !== undefined) {
      set["requirement.decisionMaker"] = normalizeString(decisionMaker);
    }

    if (!Object.keys(set).length) {
      return res.status(400).json({ message: "No requirement fields provided." });
    }

    Object.assign(
      set,
      buildLeadAutomationSet({
        leadScore: before.leadScore,
        priority: before.priority,
        leadTemperature: before.leadTemperature,
        expectedValue:
          expectedValue !== undefined
            ? Math.max(Number(expectedValue || 0), 0)
            : before.requirement?.expectedValue || 0,
        pipelineStage: before.pipelineStage,
        status: before.status,
        nextFollowUpAt: before.nextFollowUpAt,
        lastContactedAt: before.lastContactedAt,
      })
    );

    const update = { $set: set };

    if (note && normalizeString(note)) {
      update.$push = {
        notes: pushStageNote({
          note,
          type: "general",
          oldStage: before.pipelineStage || "",
          newStage: before.pipelineStage || "",
          oldStatus: before.status || "",
          newStatus: before.status || "",
          reason: "Requirement updated",
          userId: req.user._id,
        }),
      };
    }

    const lead = await Lead.findByIdAndUpdate(id, update, {
      new: true,
      runValidators: true,
    });

    await createOrUpdateLeadQueue({
      lead,
      assignedTo: lead.assignedTo,
      source: "manual",
      title: lead.nextAction || "Requirement updated. Review next action.",
      description: "Discovery information was updated",
      recommendedAction:
        lead.nextActionType === "proposal" ? "send_proposal" : "review",
      priority: lead.workQueuePriority,
      priorityScore: lead.workQueueScore,
      dueAt: lead.nextActionAt || lead.nextFollowUpAt || new Date(),
      createdBy: req.user._id,
    });

    await writeAudit({
      actorId: req.user._id,
      action: "requirement_updated",
      entityType: "Lead",
      entityId: id,
      before,
      after: lead.toObject(),
      meta,
    });

    await writeActivity({
      leadId: id,
      entityType: "Lead",
      entityId: id,
      type: "requirement_updated",
      message: "Lead requirement/discovery updated",
      createdBy: req.user._id,
      meta: {
        fields: Object.keys(set),
      },
    });

    invalidateDashboardCache();

    return res.json({
      message: "Lead requirement updated",
      lead,
    });
  } catch (err) {
    const code = err.statusCode || 500;

    return res.status(code).json({
      message: err.statusCode ? err.message : "Failed to update lead requirement",
      error: err.message,
    });
  }
};

/* =======================
   MARK CONTACTED
======================= */
export const markContacted = async (req, res) => {
  try {
    const meta = getReqMeta(req);

    const id = toObjectId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid lead id" });

    await assertLeadAccessOrThrow({ req, leadId: id });

    const before = await Lead.findById(id).lean();
    if (!before) return res.status(404).json({ message: "Lead not found" });

    const {
      note = "Lead contacted",
      outcome = "",
      nextFollowUpAt = null,
    } = req.body || {};

    const now = new Date();
    const followUpDate = validateDateOrNull(nextFollowUpAt);

    const set = {
      status: before.status === "new" ? "contacted" : before.status,
      lastContactedAt: now,
      lastActivityAt: now,
      untouchedSinceCreated: false,
    };

    if (nextFollowUpAt !== null && nextFollowUpAt !== undefined) {
      set.nextFollowUpAt = followUpDate;
    }

    Object.assign(
      set,
      buildLeadAutomationSet({
        leadScore: before.leadScore,
        priority: before.priority,
        leadTemperature: before.leadTemperature,
        expectedValue: before.requirement?.expectedValue || 0,
        pipelineStage: before.pipelineStage,
        status: set.status,
        nextFollowUpAt: set.nextFollowUpAt || before.nextFollowUpAt,
        lastContactedAt: now,
      })
    );

    const lead = await Lead.findByIdAndUpdate(
      id,
      {
        $set: set,
        $push: {
          notes: pushStageNote({
            note,
            type: "call",
            oldStage: before.pipelineStage || "",
            newStage: before.pipelineStage || "",
            oldStatus: before.status || "",
            newStatus: set.status || before.status || "",
            reason: outcome || "Contacted",
            userId: req.user._id,
          }),
        },
      },
      { new: true, runValidators: true }
    );

    await Activity.create({
      leadId: id,
      type: "call",
      status: "completed",
      priority: before.priority || "medium",
      title: "Lead contacted",
      body: normalizeString(note),
      completedAt: now,
      outcome: normalizeString(outcome),
      nextAction: lead.nextAction,
      nextActionDate: lead.nextActionAt || null,
      quickActionKey: "call_done",
      activityResult: outcome ? "neutral" : "",
      reminderStatus: lead.nextActionAt ? "scheduled" : "none",
      source: "quick_action",
      createdBy: req.user._id,
      assignedTo: lead.assignedTo || req.user._id,
    });

    if (lead.nextActionAt || lead.nextFollowUpAt) {
      await createOrUpdateLeadQueue({
        lead,
        assignedTo: lead.assignedTo,
        source: lead.isOverdue ? "overdue_follow_up" : "follow_up_due",
        title: lead.nextAction || "Follow up with lead",
        description: outcome || note,
        recommendedAction: "follow_up",
        priority: lead.workQueuePriority,
        priorityScore: lead.workQueueScore,
        dueAt: lead.nextActionAt || lead.nextFollowUpAt,
        createdBy: req.user._id,
      });
    }

    await writeAudit({
      actorId: req.user._id,
      action: "contacted",
      entityType: "Lead",
      entityId: id,
      before,
      after: lead.toObject(),
      meta,
    });

    await writeActivity({
      leadId: id,
      entityType: "Lead",
      entityId: id,
      type: "contacted",
      message: "Lead contacted",
      createdBy: req.user._id,
      meta: {
        outcome,
        nextFollowUpAt: followUpDate,
      },
    });

    invalidateDashboardCache();

    return res.json({
      message: "Lead marked as contacted",
      lead,
    });
  } catch (err) {
    const code = err.statusCode || 500;

    return res.status(code).json({
      message: err.statusCode ? err.message : "Failed to mark contacted",
      error: err.message,
    });
  }
};

/* =======================
   SET FOLLOW UP
======================= */
export const setFollowUp = async (req, res) => {
  try {
    const meta = getReqMeta(req);

    const id = toObjectId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid lead id" });

    await assertLeadAccessOrThrow({ req, leadId: id });

    const before = await Lead.findById(id).lean();
    if (!before) return res.status(404).json({ message: "Lead not found" });

    const { nextFollowUpAt, note = "", nextAction = "" } = req.body || {};

    const followUpDate = validateDateOrNull(nextFollowUpAt);
    if (!followUpDate) return res.status(400).json({ message: "Invalid nextFollowUpAt" });

    const set = {
      nextFollowUpAt: followUpDate,
      nextActionAt: followUpDate,
      nextAction: normalizeString(nextAction) || "Follow up with this lead",
      nextActionType: "follow_up",
    };

    Object.assign(
      set,
      buildLeadAutomationSet({
        leadScore: before.leadScore,
        priority: before.priority,
        leadTemperature: before.leadTemperature,
        expectedValue: before.requirement?.expectedValue || 0,
        pipelineStage: before.pipelineStage,
        status: before.status,
        nextFollowUpAt: followUpDate,
        lastContactedAt: before.lastContactedAt,
      })
    );

    const lead = await Lead.findByIdAndUpdate(
      id,
      {
        $set: set,
        ...(note && normalizeString(note)
          ? {
              $push: {
                notes: pushStageNote({
                  note,
                  type: "follow_up",
                  oldStage: before.pipelineStage || "",
                  newStage: before.pipelineStage || "",
                  oldStatus: before.status || "",
                  newStatus: before.status || "",
                  reason: "Follow-up set",
                  userId: req.user._id,
                }),
              },
            }
          : {}),
      },
      { new: true, runValidators: true }
    );

    await Activity.create({
      leadId: id,
      type: "task_followup",
      status: "pending",
      priority: before.priority || "medium",
      title: "Follow-up scheduled",
      body: normalizeString(note),
      scheduledAt: followUpDate,
      nextAction: lead.nextAction,
      nextActionDate: followUpDate,
      reminderStatus: "scheduled",
      source: "manual",
      createdBy: req.user._id,
      assignedTo: lead.assignedTo || req.user._id,
    });

    await createOrUpdateLeadQueue({
      lead,
      assignedTo: lead.assignedTo,
      source: "follow_up_due",
      title: lead.nextAction || "Follow up with lead",
      description: note,
      recommendedAction: "follow_up",
      priority: lead.workQueuePriority,
      priorityScore: lead.workQueueScore,
      dueAt: followUpDate,
      createdBy: req.user._id,
    });

    await writeAudit({
      actorId: req.user._id,
      action: "followup_set",
      entityType: "Lead",
      entityId: id,
      before,
      after: lead.toObject(),
      meta,
    });

    await writeActivity({
      leadId: id,
      entityType: "Lead",
      entityId: id,
      type: "followup_set",
      message: "Follow-up set",
      createdBy: req.user._id,
      meta: {
        nextFollowUpAt: followUpDate,
      },
    });

    invalidateDashboardCache();

    return res.json({
      message: "Follow-up set",
      lead,
    });
  } catch (err) {
    const code = err.statusCode || 500;

    return res.status(code).json({
      message: err.statusCode ? err.message : "Failed to set follow-up",
      error: err.message,
    });
  }
};

/* =======================
   MARK LEAD WON
======================= */
export const markLeadWon = async (req, res) => {
  try {
    const meta = getReqMeta(req);

    const id = toObjectId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid lead id" });

    await assertLeadAccessOrThrow({ req, leadId: id });

    const before = await Lead.findById(id).lean();
    if (!before) return res.status(404).json({ message: "Lead not found" });

    const { reason, note = "" } = req.body || {};

    if (!reason || !normalizeString(reason)) {
      return res.status(400).json({ message: "reason is required" });
    }

    const now = new Date();

    const set = {
      pipelineStage: "won",
      status: "confirmed",
      wonReason: normalizeString(reason),
      wonAt: now,
      isOverdue: false,
      overdueSince: null,
      nextAction: "Convert this won lead to customer",
      nextActionType: "convert",
      nextActionAt: null,
      workQueuePriority: "high",
      workQueueScore: 120,
      "automationFlags.needsFirstContact": false,
      "automationFlags.needsFollowUp": false,
      "automationFlags.proposalFollowUpDue": false,
      "automationFlags.dealStuck": false,
    };

    const lead = await Lead.findByIdAndUpdate(
      id,
      {
        $set: set,
        $push: {
          notes: pushStageNote({
            note: note || reason,
            type: "won_reason",
            oldStage: before.pipelineStage || "",
            newStage: "won",
            oldStatus: before.status || "",
            newStatus: "confirmed",
            reason,
            userId: req.user._id,
          }),
        },
      },
      { new: true, runValidators: true }
    );

    await WorkQueue.updateMany(
      { leadId: id, status: { $in: ["pending", "in_progress", "snoozed"] } },
      { $set: { status: "cancelled", result: "Lead won" } }
    );

    await createOrUpdateLeadQueue({
      lead,
      assignedTo: lead.assignedTo,
      source: "manual",
      title: "Convert won lead to customer",
      description: reason,
      recommendedAction: "convert_customer",
      priority: "high",
      priorityScore: 120,
      dueAt: new Date(),
      createdBy: req.user._id,
    });

    await writeAudit({
      actorId: req.user._id,
      action: "won",
      entityType: "Lead",
      entityId: id,
      before,
      after: lead.toObject(),
      meta,
    });

    await writeActivity({
      leadId: id,
      entityType: "Lead",
      entityId: id,
      type: "stage_changed",
      message: "Lead marked as won",
      createdBy: req.user._id,
      meta: {
        oldStage: before.pipelineStage,
        newStage: "won",
        oldStatus: before.status,
        newStatus: "confirmed",
        reason,
      },
    });

    invalidateDashboardCache();

    return res.json({
      message: "Lead marked as won",
      lead,
    });
  } catch (err) {
    const code = err.statusCode || 500;

    return res.status(code).json({
      message: err.statusCode ? err.message : "Failed to mark lead won",
      error: err.message,
    });
  }
};

/* =======================
   MARK LEAD LOST
======================= */
export const markLeadLost = async (req, res) => {
  try {
    const meta = getReqMeta(req);

    const id = toObjectId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid lead id" });

    await assertLeadAccessOrThrow({ req, leadId: id });

    const before = await Lead.findById(id).lean();
    if (!before) return res.status(404).json({ message: "Lead not found" });

    const { reason, note = "" } = req.body || {};

    if (!reason || !normalizeString(reason)) {
      return res.status(400).json({ message: "reason is required" });
    }

    const now = new Date();

    const lead = await Lead.findByIdAndUpdate(
      id,
      {
        $set: {
          pipelineStage: "lost",
          status: "lost",
          lostReason: normalizeString(reason),
          lostAt: now,
          isOverdue: false,
          overdueSince: null,
          nextAction: "Review lost reason",
          nextActionType: "lost_review",
          nextActionAt: null,
          workQueuePriority: "low",
          workQueueScore: 0,
          "automationFlags.needsFirstContact": false,
          "automationFlags.needsFollowUp": false,
          "automationFlags.proposalFollowUpDue": false,
          "automationFlags.dealStuck": false,
        },
        $push: {
          notes: pushStageNote({
            note: note || reason,
            type: "lost_reason",
            oldStage: before.pipelineStage || "",
            newStage: "lost",
            oldStatus: before.status || "",
            newStatus: "lost",
            reason,
            userId: req.user._id,
          }),
        },
      },
      { new: true, runValidators: true }
    );

    await WorkQueue.updateMany(
      { leadId: id, status: { $in: ["pending", "in_progress", "snoozed"] } },
      { $set: { status: "cancelled", result: "Lead lost" } }
    );

    await writeAudit({
      actorId: req.user._id,
      action: "lost",
      entityType: "Lead",
      entityId: id,
      before,
      after: lead.toObject(),
      meta,
    });

    await writeActivity({
      leadId: id,
      entityType: "Lead",
      entityId: id,
      type: "stage_changed",
      message: "Lead marked as lost",
      createdBy: req.user._id,
      meta: {
        oldStage: before.pipelineStage,
        newStage: "lost",
        oldStatus: before.status,
        newStatus: "lost",
        reason,
      },
    });

    invalidateDashboardCache();

    return res.json({
      message: "Lead marked as lost",
      lead,
    });
  } catch (err) {
    const code = err.statusCode || 500;

    return res.status(code).json({
      message: err.statusCode ? err.message : "Failed to mark lead lost",
      error: err.message,
    });
  }
};

/* =======================
   CONVERT LEAD TO CUSTOMER
======================= */
export const convertLead = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    const meta = getReqMeta(req);

    const id = toObjectId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid lead id" });

    session.startTransaction();

    const lead = await getLeadOrThrow({ req, leadId: id, session });

    if (lead.convertedCustomer || lead.customerId) {
      await session.abortTransaction();
      return res.status(400).json({ message: "Lead already converted" });
    }

    const [customer] = await Customer.create(
      [
        {
          name: lead.contact?.name,
          email: lead.contact?.email,
          phone: lead.contact?.phone,
          companyName: lead.contact?.companyName,
          source: lead.source || "",
          tags: lead.tags || [],
          createdBy: req.user._id,
          assignedTo: lead.assignedTo || req.user._id,
          leadId: lead._id,
        },
      ],
      { session }
    );

    const before = lead.toObject();

    lead.customerId = customer._id;
    lead.convertedCustomer = customer._id;
    lead.convertedAt = new Date();
    lead.pipelineStage = "won";
    lead.status = "confirmed";
    lead.isOverdue = false;
    lead.overdueSince = null;
    lead.nextAction = "";
    lead.nextActionType = "";
    lead.nextActionAt = null;
    lead.workQueueScore = 0;
    lead.workQueuePriority = "low";

    lead.notes.push(
      pushStageNote({
        note: "Lead converted to customer",
        type: "stage_change",
        oldStage: before.pipelineStage || "",
        newStage: "won",
        oldStatus: before.status || "",
        newStatus: "confirmed",
        reason: "Converted to customer",
        userId: req.user._id,
      })
    );

    await lead.save({ session });

    await WorkQueue.updateMany(
      { leadId: id, status: { $in: ["pending", "in_progress", "snoozed"] } },
      { $set: { status: "done", result: "Converted to customer", doneAt: new Date() } },
      { session }
    );

    await writeConversionLog({
      session,
      leadId: lead._id,
      customerId: customer._id,
      convertedBy: req.user._id,
      leadSnapshot: before,
      customerSnapshot: customer.toObject(),
    });

    await writeAudit({
      session,
      actorId: req.user._id,
      action: "convert",
      entityType: "Lead",
      entityId: lead._id,
      before,
      after: lead.toObject(),
      meta,
    });

    await writeActivity({
      session,
      leadId: lead._id,
      customerId: customer._id,
      entityType: "Lead",
      entityId: lead._id,
      type: "converted",
      message: "Lead converted to customer",
      createdBy: req.user._id,
    });

    await session.commitTransaction();

    invalidateDashboardCache();

    return res.json({
      message: "Lead converted to customer",
      customer,
      customerId: customer._id,
      lead,
    });
  } catch (err) {
    try {
      await session.abortTransaction();
    } catch {}

    const code = err.statusCode || 500;

    return res.status(code).json({
      message: err.statusCode ? err.message : "Failed to convert lead",
      error: err.message,
    });
  } finally {
    session.endSession();
  }
};

/* =======================
   GET LEAD TIMELINE
======================= */
export const getLeadTimeline = async (req, res) => {
  try {
    const id = toObjectId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid lead id" });

    await assertLeadAccessOrThrow({ req, leadId: id });

    const [logs, activities, proposals, deals, queueItems] = await Promise.all([
      ActivityLog.find({ leadId: id })
        .populate("createdBy", "name email role avatarUrl")
        .sort({ createdAt: -1 })
        .limit(100)
        .lean(),

      Activity.find({ leadId: id })
        .populate("createdBy", "name email role avatarUrl")
        .populate("assignedTo", "name email role avatarUrl")
        .sort({ createdAt: -1 })
        .limit(100)
        .lean(),

      Proposal.find({ leadId: id })
        .select("proposalNo title status items grandTotal currency validTill sentAt acceptedAt rejectedAt followupDueAt terms notes ownerId dealId createdAt")
        .sort({ createdAt: -1 })
        .lean(),

      Deal.find({ leadId: id })
        .select("dealNo title stage items subtotal discountTotal grandTotal currency probability expectedRevenue dealHealth expectedCloseDate proposalStatus proposalSentAt quotationValidTill requirementSnapshot ownerId notes nextDealAction nextDealActionAt stuckReason wonReason lostReason wonAt lostAt createdAt")
        .sort({ createdAt: -1 })
        .lean(),

      WorkQueue.find({ leadId: id })
        .select("title source recommendedAction priority priorityScore status dueAt doneAt snoozedUntil result createdAt")
        .sort({ createdAt: -1 })
        .limit(50)
        .lean(),
    ]);

    return res.json({
      timeline: {
        logs,
        activities,
        proposals,
        deals,
        queueItems,
      },
    });
  } catch (err) {
    const code = err.statusCode || 500;

    return res.status(code).json({
      message: err.statusCode ? err.message : "Failed to get lead timeline",
      error: err.message,
    });
  }
};

/* =======================
   ADMIN LEAD ACCESS CONTROL
======================= */
export const updateLeadAccess = async (req, res) => {
  try {
    if (!isAdminOrSuperAdmin(req)) {
      return res.status(403).json({
        message: "Only admin/superadmin can manage lead access.",
      });
    }

    const id = toObjectId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid lead id" });

    const lead = await Lead.findById(id);
    if (!lead) return res.status(404).json({ message: "Lead not found" });

    const addUserIds = Array.isArray(req.body?.addUserIds)
      ? req.body.addUserIds
      : [];

    const removeUserIds = Array.isArray(req.body?.removeUserIds)
      ? req.body.removeUserIds
      : [];

    const allowedUserIds = Array.isArray(req.body?.allowedUserIds)
      ? req.body.allowedUserIds
      : null;

    const lockOwner = req.body?.lockOwner;

    const normalizeIds = (arr) => {
      const out = [];
      const seen = new Set();

      for (const v of arr) {
        const s = String(v ?? "").trim();
        if (!s) continue;
        if (!mongoose.isValidObjectId(s)) continue;
        if (seen.has(s)) continue;

        seen.add(s);
        out.push(new mongoose.Types.ObjectId(s));
      }

      return out;
    };

    const addIds = normalizeIds(addUserIds);
    const remIds = normalizeIds(removeUserIds);

    const exactAllowedIds = allowedUserIds === null
      ? null
      : normalizeIds(allowedUserIds);
    const set = new Set(
      (exactAllowedIds || lead.allowedUsers || []).map((x) => String(x))
    );

    if (exactAllowedIds === null) {
      for (const a of addIds) set.add(String(a));
      for (const r of remIds) set.delete(String(r));
    }

    lead.allowedUsers = Array.from(set).map(
      (s) => new mongoose.Types.ObjectId(s)
    );

    if (lockOwner !== undefined) {
      const b = String(lockOwner).toLowerCase();

      if (!["true", "false"].includes(b)) {
        return res.status(400).json({ message: "lockOwner must be boolean." });
      }

      lead.ownerLocked = b === "true";
    }

    await lead.save();

    return res.json({
      message: "Lead access updated",
      lead: {
        _id: lead._id,
        ownerLocked: lead.ownerLocked,
        allowedUsers: lead.allowedUsers,
      },
    });
  } catch (err) {
    return res.status(500).json({
      message: "Failed to update lead access",
      error: err.message,
    });
  }
};

/* =======================
   DELETE LEAD
======================= */
export const deleteLead = async (req, res) => {
  try {
    const meta = getReqMeta(req);

    const id = toObjectId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid lead id" });

    if (!isAdminOrSuperAdmin(req)) {
      return res.status(403).json({
        message: "Only admin/superadmin can delete leads.",
      });
    }

    await verifyAdminPassword(req);

    const before = await Lead.findById(id).lean();
    if (!before) return res.status(404).json({ message: "Lead not found" });

    await Lead.findByIdAndDelete(id);

    await WorkQueue.updateMany(
      { leadId: id, status: { $in: ["pending", "in_progress", "snoozed"] } },
      { $set: { status: "cancelled", result: "Lead deleted" } }
    );

    await writeAudit({
      actorId: req.user._id,
      action: "delete",
      entityType: "Lead",
      entityId: id,
      before,
      after: null,
      meta,
    });

    await writeActivity({
      leadId: id,
      entityType: "Lead",
      entityId: id,
      type: "deleted",
      message: "Lead deleted",
      createdBy: req.user._id,
    });

    invalidateDashboardCache();

    return res.json({
      message: "Lead deleted",
    });
  } catch (err) {
    return res.status(err.statusCode || 500).json({
      message: err.statusCode ? err.message : "Failed to delete lead",
      error: err.message,
    });
  }
};
