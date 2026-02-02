// controllers/lead.controller.js
import mongoose from "mongoose";
import Lead from "../models/lead.model.js";
import Customer from "../models/customer.model.js";
import PurchaseType from "../models/purchaseType.model.js"; // ✅ NEW (master list)
import { dashboardCache } from "../utils/cache.js";
import { getReqMeta, writeAudit, writeActivity, writeConversionLog } from "../utils/audit.js";

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
  return mongoose.Types.ObjectId.isValid(v) ? new mongoose.Types.ObjectId(v) : null;
};

const pick = (obj, keys) =>
  keys.reduce((acc, k) => {
    if (obj?.[k] !== undefined) acc[k] = obj[k];
    return acc;
  }, {});

const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

const applyCursor = (filter, cursor) => {
  const c = toObjectId(cursor);
  if (c) filter._id = { ...(filter._id || {}), $lt: c };
};

/**
 * ✅ Allowed fields for server-side projection (dynamic columns)
 */
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
  "purchaseType", // ✅ keep string field in Lead
  "source",
  "tags",
  "assignedTo",
  "createdBy",
  "lastContactedAt",
  "nextFollowUpAt",
  "customerId",
  "convertedCustomer",
  "convertedAt",
  "createdAt",
  "updatedAt",
]);

/**
 * ✅ Always include these for row actions + stable UI behavior
 */
const ALWAYS_INCLUDE_FOR_LIST = {
  _id: 1,
  status: 1,
  pipelineStage: 1,
  "contact.name": 1,
  "contact.companyName": 1,
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
    if (!ALLOWED_LIST_FIELDS.has(f)) continue;
    proj[f] = 1;
  }

  return { ...proj, ...ALWAYS_INCLUDE_FOR_LIST };
};

// ✅ helper: validate purchase type against master list (accepts key or name)
const validatePurchaseTypeOrThrow = async (purchaseType) => {
  const pt = String(purchaseType || "").trim();
  if (!pt) return ""; // allow empty

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

/* =======================
   CREATE LEAD (UPDATED)
======================= */
export const createLead = async (req, res) => {
  try {
    const meta = getReqMeta(req);
    const { contact, source, tags, assignedTo, company, priority, purchaseType } = req.body || {};

    if (!contact?.name || !contact?.companyName) {
      return res.status(400).json({ message: "contact.name and contact.companyName are required." });
    }

    // ✅ validate priority (optional)
    const pr = priority ? String(priority).toLowerCase().trim() : "medium";
    const safePriority = ["low", "medium", "high"].includes(pr) ? pr : "medium";

    // ✅ validate purchaseType (must exist in PurchaseType master list if provided)
    const safePurchaseType = await validatePurchaseTypeOrThrow(purchaseType);

    const assignedUserId = toObjectId(assignedTo) || req.user._id;

    const doc = await Lead.create({
      contact: {
        name: String(contact.name).trim(),
        email: String(contact.email || "").trim().toLowerCase(),
        phone: String(contact.phone || "").trim(),
        companyName: String(contact.companyName).trim(),
      },
      source: source ? String(source).trim() : "",
      tags: Array.isArray(tags) ? tags.map((t) => String(t).trim()).filter(Boolean) : [],
      company: {
        website: String(company?.website || "").trim(),
        industry: String(company?.industry || "").trim(),
        address: String(company?.address || "").trim(),
      },

      // ✅ new fields
      priority: safePriority,
      purchaseType: safePurchaseType,

      createdBy: req.user._id,
      assignedTo: assignedUserId,
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

    return res.status(201).json({ message: "Lead created", lead: doc });
  } catch (err) {
    const code = err.statusCode || 500;
    return res.status(code).json({ message: err.statusCode ? err.message : "Failed to create lead", error: err.message });
  }
};

/* =======================
   LIST LEADS (optimized)
======================= */
export const listLeads = async (req, res) => {
  try {
    const {
      status,
      pipelineStage,
      priority,
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
      cursor,
      limit,
      fields,
    } = req.query;

    const pageSize = clamp(parseInt(limit || "20", 10), 1, 100);
    const filter = {};

    if (status) filter.status = status;
    if (pipelineStage) filter.pipelineStage = pipelineStage;
    if (source) filter.source = String(source).trim();

    if (priority) {
      const pr = String(priority).toLowerCase().trim();
      if (["low", "medium", "high"].includes(pr)) filter.priority = pr;
    }

    if (purchaseType) filter.purchaseType = String(purchaseType).trim();

    const assignedId = toObjectId(assignedTo);
    if (assignedId) filter.assignedTo = assignedId;

    const createdId = toObjectId(createdBy);
    if (createdId) filter.createdBy = createdId;

    if (tag) filter.tags = String(tag).trim();

    if (nextFollowUpFrom || nextFollowUpTo) {
      filter.nextFollowUpAt = {};
      if (nextFollowUpFrom) filter.nextFollowUpAt.$gte = new Date(nextFollowUpFrom);
      if (nextFollowUpTo) filter.nextFollowUpAt.$lte = new Date(nextFollowUpTo);
    }

    if (lastContactedFrom || lastContactedTo) {
      filter.lastContactedAt = {};
      if (lastContactedFrom) filter.lastContactedAt.$gte = new Date(lastContactedFrom);
      if (lastContactedTo) filter.lastContactedAt.$lte = new Date(lastContactedTo);
    }

    if (cursor) applyCursor(filter, cursor);

    const dynamicProjection = parseFieldsProjection(fields);

    const defaultProjection = {
      leadNumber: 1,
      contact: 1,
      status: 1,
      pipelineStage: 1,
      priority: 1,
      purchaseType: 1,
      source: 1,
      tags: 1,
      assignedTo: 1,
      createdBy: 1,
      lastContactedAt: 1,
      nextFollowUpAt: 1,
      customerId: 1,
      convertedCustomer: 1,
      convertedAt: 1,
      createdAt: 1,
      updatedAt: 1,
      _id: 1,
    };

    const projection = dynamicProjection || defaultProjection;

    let query = Lead.find(filter).select(projection).lean({ virtuals: false });

    if (q && String(q).trim()) {
      query = query
        .find({ ...filter, $text: { $search: String(q).trim() } })
        .select({ ...projection, score: { $meta: "textScore" } })
        .sort({ score: { $meta: "textScore" }, _id: -1 });
    } else {
      query = query.sort({ _id: -1 });
    }

    const rows = await query.limit(pageSize + 1);

    const hasNextPage = rows.length > pageSize;
    const items = hasNextPage ? rows.slice(0, pageSize) : rows;
    const nextCursor = hasNextPage ? String(items[items.length - 1]._id) : null;

    return res.json({ items, pageInfo: { limit: pageSize, hasNextPage, nextCursor } });
  } catch (err) {
    return res.status(500).json({ message: "Failed to list leads", error: err.message });
  }
};

export const getLeadById = async (req, res) => {
  try {
    const id = toObjectId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid lead id" });

    const lead = await Lead.findById(id).lean();
    if (!lead) return res.status(404).json({ message: "Lead not found" });

    return res.json({ lead });
  } catch (err) {
    return res.status(500).json({ message: "Failed to get lead", error: err.message });
  }
};

/* =======================
   UPDATE LEAD + AUDIT (UPDATED)
======================= */
export const updateLead = async (req, res) => {
  try {
    const meta = getReqMeta(req);
    const id = toObjectId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid lead id" });

    const before = await Lead.findById(id).lean();
    if (!before) return res.status(404).json({ message: "Lead not found" });

    const allowedTop = [
      "status",
      "pipelineStage",
      "source",
      "tags",
      "assignedTo",
      "lastContactedAt",
      "nextFollowUpAt",
      "priority",
      "purchaseType", // ✅ NEW
    ];

    const allowedContact = ["name", "email", "phone", "companyName"];
    const allowedCompany = ["website", "industry", "address"];

    const payload = pick(req.body || {}, allowedTop);

    if (payload.source !== undefined) payload.source = String(payload.source || "").trim();

    if (payload.priority !== undefined) {
      const pr = String(payload.priority || "").toLowerCase().trim();
      if (!["low", "medium", "high"].includes(pr)) {
        return res.status(400).json({ message: "Invalid priority. Use: low, medium, high." });
      }
      payload.priority = pr;
    }

    // ✅ validate purchaseType if provided (must exist in master list)
    if (payload.purchaseType !== undefined) {
      payload.purchaseType = await validatePurchaseTypeOrThrow(payload.purchaseType);
    }

    if (payload.tags !== undefined) {
      payload.tags = Array.isArray(payload.tags)
        ? payload.tags.map((t) => String(t).trim()).filter(Boolean)
        : [];
    }

    if (payload.assignedTo !== undefined) {
      const aid = toObjectId(payload.assignedTo);
      if (!aid) return res.status(400).json({ message: "Invalid assignedTo id" });
      payload.assignedTo = aid;
    }

    if (payload.lastContactedAt !== undefined) {
      payload.lastContactedAt = payload.lastContactedAt ? new Date(payload.lastContactedAt) : null;
    }

    if (payload.nextFollowUpAt !== undefined) {
      payload.nextFollowUpAt = payload.nextFollowUpAt ? new Date(payload.nextFollowUpAt) : null;
    }

    const contactPatch = pick(req.body?.contact || {}, allowedContact);
    if (Object.keys(contactPatch).length) {
      if (contactPatch.email !== undefined)
        contactPatch.email = String(contactPatch.email || "").trim().toLowerCase();
      if (contactPatch.phone !== undefined)
        contactPatch.phone = String(contactPatch.phone || "").trim();
      if (contactPatch.name !== undefined)
        contactPatch.name = String(contactPatch.name || "").trim();
      if (contactPatch.companyName !== undefined)
        contactPatch.companyName = String(contactPatch.companyName || "").trim();
      payload.contact = contactPatch;
    }

    const companyPatch = pick(req.body?.company || {}, allowedCompany);
    if (Object.keys(companyPatch).length) {
      Object.keys(companyPatch).forEach((k) => (companyPatch[k] = String(companyPatch[k] || "").trim()));
      payload.company = companyPatch;
    }

    const lead = await Lead.findByIdAndUpdate(id, { $set: payload }, { new: true, runValidators: true });
    if (!lead) return res.status(404).json({ message: "Lead not found" });

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
      meta: { fields: Object.keys(payload) },
    });

    return res.json({ message: "Lead updated", lead });
  } catch (err) {
    const code = err.statusCode || 500;
    return res.status(code).json({ message: err.statusCode ? err.message : "Failed to update lead", error: err.message });
  }
};

export const addLeadNote = async (req, res) => {
  try {
    const meta = getReqMeta(req);
    const id = toObjectId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid lead id" });

    const { note } = req.body || {};
    if (!note || !String(note).trim()) return res.status(400).json({ message: "note is required" });

    const before = await Lead.findById(id).lean();
    if (!before) return res.status(404).json({ message: "Lead not found" });

    const lead = await Lead.findByIdAndUpdate(
      id,
      {
        $push: {
          notes: {
            note: String(note).trim(),
            createdBy: req.user._id,
            createdAt: new Date(),
          },
        },
      },
      { new: true }
    );

    await writeAudit({
      actorId: req.user._id,
      action: "note",
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
      message: "Note added to lead",
      createdBy: req.user._id,
    });

    return res.json({ message: "Note added", lead });
  } catch (err) {
    return res.status(500).json({ message: "Failed to add note", error: err.message });
  }
};

export const markContacted = async (req, res) => {
  try {
    const meta = getReqMeta(req);
    const id = toObjectId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid lead id" });

    const before = await Lead.findById(id).lean();
    if (!before) return res.status(404).json({ message: "Lead not found" });

    const lead = await Lead.findByIdAndUpdate(
      id,
      { $set: { status: "contacted", lastContactedAt: new Date() } },
      { new: true }
    );

    await writeAudit({
      actorId: req.user._id,
      action: "status",
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
      message: "Lead marked as contacted",
      createdBy: req.user._id,
    });

    return res.json({ message: "Lead marked as contacted", lead });
  } catch (err) {
    return res.status(500).json({ message: "Failed to mark contacted", error: err.message });
  }
};

export const setFollowUp = async (req, res) => {
  try {
    const meta = getReqMeta(req);
    const id = toObjectId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid lead id" });

    const { nextFollowUpAt } = req.body || {};
    if (!nextFollowUpAt) return res.status(400).json({ message: "nextFollowUpAt is required" });

    const dt = new Date(nextFollowUpAt);
    if (Number.isNaN(dt.getTime())) return res.status(400).json({ message: "Invalid nextFollowUpAt date" });

    const before = await Lead.findById(id).lean();
    if (!before) return res.status(404).json({ message: "Lead not found" });

    const lead = await Lead.findByIdAndUpdate(id, { $set: { nextFollowUpAt: dt } }, { new: true });

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
      type: "followup_set",
      message: "Follow-up date updated",
      createdBy: req.user._id,
      meta: { nextFollowUpAt: dt },
    });

    return res.json({ message: "Follow-up updated", lead });
  } catch (err) {
    return res.status(500).json({ message: "Failed to set follow-up", error: err.message });
  }
};

/* =======================
   CONVERT (best practice)
======================= */
export const convertLeadToCustomer = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    const meta = getReqMeta(req);
    const leadId = toObjectId(req.params.id);
    if (!leadId) return res.status(400).json({ message: "Invalid lead id" });

    session.startTransaction();

    const lead = await Lead.findById(leadId).session(session);
    if (!lead) {
      await session.abortTransaction();
      return res.status(404).json({ message: "Lead not found" });
    }

    if (lead.convertedCustomer) {
      await session.abortTransaction();
      return res.status(409).json({ message: "Lead already converted", customerId: lead.convertedCustomer });
    }

    const existingCustomer = await Customer.findOne({ leadId: lead._id }).session(session).select("_id status");
    if (existingCustomer?._id) {
      lead.convertedCustomer = existingCustomer._id;
      lead.customerId = existingCustomer._id;
      lead.convertedAt = new Date();
      lead.pipelineStage = "won";
      lead.status = "confirmed";
      await lead.save({ session });

      await session.commitTransaction();
      invalidateDashboardCache();

      return res.status(200).json({
        message: "Lead already has customer (relinked)",
        leadId: String(lead._id),
        customerId: String(existingCustomer._id),
      });
    }

    const customerPayload = {
      name: lead.contact.name,
      companyName: lead.contact.companyName,
      email: lead.contact.email,
      phone: lead.contact.phone,
      address: lead.company?.address || "",

      contactPerson: {
        name: lead.contact.name,
        email: lead.contact.email || "",
        phone: lead.contact.phone || "",
        designation: "",
      },

      secondaryContacts: [],
      tags: lead.tags || [],
      lifecycleStage: "prospect",

      status: "pending",
      customerType: "new",

      origin: "lead",
      leadId: lead._id,

      createdBy: req.user._id,
      assignedTo: [lead.assignedTo],

      customerFiles: [],
      engagements: [],
      crmTasks: [],
    };

    const [customer] = await Customer.create([customerPayload], { session });

    lead.convertedCustomer = customer._id;
    lead.customerId = customer._id;
    lead.convertedAt = new Date();
    lead.pipelineStage = "won";
    lead.status = "confirmed";

    await lead.save({ session });

    await writeConversionLog({
      session,
      leadId: lead._id,
      customerId: customer._id,
      convertedBy: req.user._id,
      leadSnapshot: lead.toObject(),
      customerSnapshot: customer.toObject(),
    });

    await writeAudit({
      session,
      actorId: req.user._id,
      action: "convert",
      entityType: "Lead",
      entityId: lead._id,
      before: null,
      after: { customerId: customer._id },
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
      meta: { customerId: customer._id },
    });

    await writeActivity({
      session,
      leadId: lead._id,
      customerId: customer._id,
      entityType: "Customer",
      entityId: customer._id,
      type: "created",
      message: "Customer created from lead",
      createdBy: req.user._id,
      meta: { leadId: lead._id },
    });

    await session.commitTransaction();
    invalidateDashboardCache();

    return res.status(200).json({
      message: "Lead converted to customer",
      leadId: String(lead._id),
      customerId: String(customer._id),
      customerStatus: customer.status,
    });
  } catch (err) {
    try {
      await session.abortTransaction();
    } catch {}
    return res.status(500).json({ message: "Failed to convert lead", error: err.message });
  } finally {
    session.endSession();
  }
};

export const deleteLead = async (req, res) => {
  try {
    const meta = getReqMeta(req);
    const id = toObjectId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid lead id" });

    const before = await Lead.findById(id).lean();
    if (!before) return res.status(404).json({ message: "Lead not found" });

    await Lead.findByIdAndDelete(id);
    invalidateDashboardCache();

    await writeAudit({
      actorId: req.user._id,
      action: "delete",
      entityType: "Lead",
      entityId: id,
      before,
      after: null,
      meta,
    });

    return res.json({ message: "Lead deleted" });
  } catch (err) {
    return res.status(500).json({ message: "Failed to delete lead", error: err.message });
  }
};
