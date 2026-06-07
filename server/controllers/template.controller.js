import mongoose from "mongoose";
import MessageTemplate from "../models/messageTemplate.model.js";
import { getReqMeta, writeAudit, writeActivity } from "../utils/audit.js";

const toObjectId = (v) => {
  if (!v) return null;
  return mongoose.Types.ObjectId.isValid(v)
    ? new mongoose.Types.ObjectId(v)
    : null;
};

const normalizeString = (value = "") => String(value || "").trim();

const normalizeKey = (value = "") => {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
};

const isAdminOrSuperAdmin = (req) => {
  const role = req?.user?.role;
  return role === "admin" || role === "superadmin";
};

const CHANNELS = ["call_note", "whatsapp", "email", "meeting", "proposal_note", "general"];

const PURPOSES = [
  "first_contact",
  "follow_up",
  "proposal_sent",
  "proposal_reminder",
  "meeting_schedule",
  "lost_reason",
  "won_note",
  "general",
];

/* =======================
   CREATE TEMPLATE
======================= */
export const createTemplate = async (req, res) => {
  try {
    const meta = getReqMeta(req);

    const {
      name,
      key,
      channel = "general",
      purpose = "general",
      subject = "",
      body,
      variables = [],
      isActive = true,
    } = req.body || {};

    if (!name || !normalizeString(name)) {
      return res.status(400).json({ message: "name is required" });
    }

    if (!body || !normalizeString(body)) {
      return res.status(400).json({ message: "body is required" });
    }

    if (!CHANNELS.includes(channel)) {
      return res.status(400).json({
        message: `Invalid channel. Use: ${CHANNELS.join(", ")}`,
      });
    }

    if (!PURPOSES.includes(purpose)) {
      return res.status(400).json({
        message: `Invalid purpose. Use: ${PURPOSES.join(", ")}`,
      });
    }

    const safeKey = normalizeKey(key || name);

    const exists = await MessageTemplate.exists({ key: safeKey });
    if (exists) {
      return res.status(409).json({
        message: "Template key already exists",
      });
    }

    const template = await MessageTemplate.create({
      name: normalizeString(name),
      key: safeKey,
      channel,
      purpose,
      subject: normalizeString(subject),
      body: normalizeString(body),
      variables: Array.isArray(variables)
        ? variables.map((v) => normalizeString(v)).filter(Boolean)
        : [],
      isActive: Boolean(isActive),
      createdBy: req.user._id,
    });

    await writeAudit({
      actorId: req.user._id,
      action: "create",
      entityType: "MessageTemplate",
      entityId: template._id,
      before: null,
      after: template.toObject(),
      meta,
    });

    return res.status(201).json({
      message: "Template created",
      template,
    });
  } catch (err) {
    const code = err.statusCode || 500;

    return res.status(code).json({
      message: err.statusCode ? err.message : "Failed to create template",
      error: err.message,
    });
  }
};

/* =======================
   LIST TEMPLATES
======================= */
export const listTemplates = async (req, res) => {
  try {
    const {
      channel,
      purpose,
      isActive,
      q,
      limit = 100,
    } = req.query || {};

    const filter = {};

    if (channel && CHANNELS.includes(String(channel))) {
      filter.channel = channel;
    }

    if (purpose && PURPOSES.includes(String(purpose))) {
      filter.purpose = purpose;
    }

    if (String(isActive).toLowerCase() === "true") filter.isActive = true;
    if (String(isActive).toLowerCase() === "false") filter.isActive = false;

    if (q && normalizeString(q)) {
      filter.$or = [
        { name: { $regex: normalizeString(q), $options: "i" } },
        { key: { $regex: normalizeString(q), $options: "i" } },
        { body: { $regex: normalizeString(q), $options: "i" } },
      ];
    }

    const pageSize = Math.min(Math.max(parseInt(limit || "100", 10), 1), 200);

    const templates = await MessageTemplate.find(filter)
      .populate("createdBy", "name email role avatarUrl")
      .sort({ isActive: -1, usageCount: -1, createdAt: -1 })
      .limit(pageSize)
      .lean();

    return res.json({ templates });
  } catch (err) {
    const code = err.statusCode || 500;

    return res.status(code).json({
      message: err.statusCode ? err.message : "Failed to list templates",
      error: err.message,
    });
  }
};

/* =======================
   GET TEMPLATE
======================= */
export const getTemplateById = async (req, res) => {
  try {
    const id = toObjectId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid template id" });

    const template = await MessageTemplate.findById(id)
      .populate("createdBy", "name email role avatarUrl")
      .lean();

    if (!template) return res.status(404).json({ message: "Template not found" });

    return res.json({ template });
  } catch (err) {
    const code = err.statusCode || 500;

    return res.status(code).json({
      message: err.statusCode ? err.message : "Failed to get template",
      error: err.message,
    });
  }
};

/* =======================
   UPDATE TEMPLATE
======================= */
export const updateTemplate = async (req, res) => {
  try {
    const meta = getReqMeta(req);

    const id = toObjectId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid template id" });

    const before = await MessageTemplate.findById(id).lean();
    if (!before) return res.status(404).json({ message: "Template not found" });

    if (!isAdminOrSuperAdmin(req) && String(before.createdBy) !== String(req.user._id)) {
      return res.status(403).json({
        message: "Only creator or admin can update this template.",
      });
    }

    const set = {};

    if (req.body?.name !== undefined) set.name = normalizeString(req.body.name);

    if (req.body?.key !== undefined) {
      const nextKey = normalizeKey(req.body.key);
      const exists = await MessageTemplate.exists({
        key: nextKey,
        _id: { $ne: id },
      });

      if (exists) {
        return res.status(409).json({
          message: "Template key already exists",
        });
      }

      set.key = nextKey;
    }

    if (req.body?.channel !== undefined) {
      if (!CHANNELS.includes(req.body.channel)) {
        return res.status(400).json({ message: "Invalid channel" });
      }

      set.channel = req.body.channel;
    }

    if (req.body?.purpose !== undefined) {
      if (!PURPOSES.includes(req.body.purpose)) {
        return res.status(400).json({ message: "Invalid purpose" });
      }

      set.purpose = req.body.purpose;
    }

    if (req.body?.subject !== undefined) {
      set.subject = normalizeString(req.body.subject);
    }

    if (req.body?.body !== undefined) {
      if (!normalizeString(req.body.body)) {
        return res.status(400).json({ message: "body cannot be empty" });
      }

      set.body = normalizeString(req.body.body);
    }

    if (req.body?.variables !== undefined) {
      set.variables = Array.isArray(req.body.variables)
        ? req.body.variables.map((v) => normalizeString(v)).filter(Boolean)
        : [];
    }

    if (req.body?.isActive !== undefined) {
      set.isActive = Boolean(req.body.isActive);
    }

    if (!Object.keys(set).length) {
      return res.status(400).json({ message: "No valid fields provided." });
    }

    const template = await MessageTemplate.findByIdAndUpdate(
      id,
      { $set: set },
      { new: true, runValidators: true }
    );

    await writeAudit({
      actorId: req.user._id,
      action: "update",
      entityType: "MessageTemplate",
      entityId: id,
      before,
      after: template.toObject(),
      meta,
    });

    return res.json({
      message: "Template updated",
      template,
    });
  } catch (err) {
    const code = err.statusCode || 500;

    return res.status(code).json({
      message: err.statusCode ? err.message : "Failed to update template",
      error: err.message,
    });
  }
};

/* =======================
   USE TEMPLATE / RENDER
======================= */
export const useTemplate = async (req, res) => {
  try {
    const meta = getReqMeta(req);

    const id = toObjectId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid template id" });

    const { data = {}, leadId = null } = req.body || {};

    const template = await MessageTemplate.findById(id);
    if (!template) return res.status(404).json({ message: "Template not found" });

    let renderedSubject = template.subject || "";
    let renderedBody = template.body || "";

    const variables = data && typeof data === "object" ? data : {};

    Object.entries(variables).forEach(([key, value]) => {
      const pattern = new RegExp(`{{\\s*${key}\\s*}}`, "g");
      renderedSubject = renderedSubject.replace(pattern, String(value ?? ""));
      renderedBody = renderedBody.replace(pattern, String(value ?? ""));
    });

    template.usageCount = Number(template.usageCount || 0) + 1;
    await template.save();

    await writeAudit({
      actorId: req.user._id,
      action: "template_used",
      entityType: "MessageTemplate",
      entityId: template._id,
      before: null,
      after: {
        renderedSubject,
        renderedBody,
      },
      meta,
    });

    if (leadId) {
      await writeActivity({
        leadId: toObjectId(leadId),
        entityType: "MessageTemplate",
        entityId: template._id,
        type: "template_used",
        message: `Template used: ${template.name}`,
        createdBy: req.user._id,
      });
    }

    return res.json({
      message: "Template rendered",
      subject: renderedSubject,
      body: renderedBody,
      template,
    });
  } catch (err) {
    const code = err.statusCode || 500;

    return res.status(code).json({
      message: err.statusCode ? err.message : "Failed to use template",
      error: err.message,
    });
  }
};

/* =======================
   DELETE TEMPLATE
======================= */
export const deleteTemplate = async (req, res) => {
  try {
    const meta = getReqMeta(req);

    const id = toObjectId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid template id" });

    const before = await MessageTemplate.findById(id).lean();
    if (!before) return res.status(404).json({ message: "Template not found" });

    if (!isAdminOrSuperAdmin(req) && String(before.createdBy) !== String(req.user._id)) {
      return res.status(403).json({
        message: "Only creator or admin can delete this template.",
      });
    }

    await MessageTemplate.findByIdAndDelete(id);

    await writeAudit({
      actorId: req.user._id,
      action: "delete",
      entityType: "MessageTemplate",
      entityId: id,
      before,
      after: null,
      meta,
    });

    return res.json({
      message: "Template deleted",
    });
  } catch (err) {
    const code = err.statusCode || 500;

    return res.status(code).json({
      message: err.statusCode ? err.message : "Failed to delete template",
      error: err.message,
    });
  }
};