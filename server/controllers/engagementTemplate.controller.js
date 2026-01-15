// controllers/engagementTemplate.controller.js
import mongoose from "mongoose";
import EngagementTemplate from "../models/engagementTemplate.model.js";

const isAdminOrSuperAdmin = (req) => {
  const role = req?.user?.role;
  return role === "admin" || role === "superadmin";
};

const handleMongoDuplicateKey = (err) => {
  if (err?.code === 11000) {
    const key = Object.keys(err.keyPattern || {})[0] || "field";
    return { message: `Duplicate ${key}. This ${key} already exists.` };
  }
  return null;
};

const clampInt = (n, min, max, fallback) => {
  const v = Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(v)));
};

const toId = (v) => {
  if (!v) return null;
  if (!mongoose.isValidObjectId(v)) return null;
  return new mongoose.Types.ObjectId(String(v));
};

const normalizeSubEngagements = (subEngagements) => {
  if (subEngagements === undefined) return { subEngagements: [] };
  if (!Array.isArray(subEngagements))
    return { error: "subEngagements must be an array." };

  // hard safety limit
  if (subEngagements.length > 200)
    return { error: "Too many subEngagements (max 200)." };

  const arr = [];
  for (const s of subEngagements) {
    if (typeof s === "string") {
      const t = s.trim();
      if (t) arr.push(t);
    } else if (s && typeof s === "object") {
      const t = String(s.text ?? "").trim();
      if (t) arr.push(t);
    }
  }

  // remove duplicates (case-insensitive) while keeping order
  const seen = new Set();
  const normalized = [];
  for (const t of arr) {
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push({ text: t });
  }

  return { subEngagements: normalized };
};

/**
 * ✅ ADMIN: Create engagement template
 * POST /engagement-templates
 * body: { title, subEngagements?: [] }
 */
export const createEngagementTemplate = async (req, res) => {
  try {
    if (!isAdminOrSuperAdmin(req)) {
      return res
        .status(403)
        .json({ message: "Only admin/superadmin can create engagement types." });
    }

    const title = String(req.body.title ?? "").trim();
    if (!title) return res.status(400).json({ message: "title is required." });

    const { subEngagements, error } = normalizeSubEngagements(
      req.body.subEngagements
    );
    if (error) return res.status(400).json({ message: error });

    const tpl = await EngagementTemplate.create({
      title,
      subEngagements,
      createdBy: req.user._id,
      isActive: true,
    });

    return res.status(201).json({
      message: "Engagement type created.",
      template: {
        _id: tpl._id,
        title: tpl.title,
        subEngagements: tpl.subEngagements,
        isActive: tpl.isActive,
        createdAt: tpl.createdAt,
        updatedAt: tpl.updatedAt,
      },
    });
  } catch (err) {
    const dup = handleMongoDuplicateKey(err);
    if (dup) return res.status(409).json(dup);

    return res.status(500).json({
      message: "Server error in createEngagementTemplate.",
      error: err.message,
    });
  }
};

/**
 * ✅ List engagement templates
 * GET /engagement-templates?active=true&q=searchText&limit=200&cursor=<ObjectId>&sort=title|newest
 */
export const listEngagementTemplates = async (req, res) => {
  try {
    const active = String(req.query.active ?? "true") === "true";
    const qText = String(req.query.q ?? "").trim();
    const sortMode = String(req.query.sort ?? "title"); // "title" | "newest"
    const limit = clampInt(req.query.limit, 1, 200, 200);

    const cursorId = req.query.cursor ? toId(req.query.cursor) : null;

    const filter = {};
    if (active) filter.isActive = true;

    if (qText) {
      filter.$text = { $search: qText };
    }

    // cursor only for newest
    if (sortMode === "newest" && cursorId) {
      filter._id = { $lt: cursorId };
    }

    const projection = qText
      ? {
          score: { $meta: "textScore" },
          title: 1,
          subEngagements: 1,
          isActive: 1,
          createdAt: 1,
          updatedAt: 1,
        }
      : {
          title: 1,
          subEngagements: 1,
          isActive: 1,
          createdAt: 1,
          updatedAt: 1,
        };

    let sort = { title: 1 };
    if (sortMode === "newest") sort = { _id: -1 };
    if (qText) sort = { score: { $meta: "textScore" }, title: 1 };

    const templates = await EngagementTemplate.find(filter)
      .collation({ locale: "en", strength: 2 })
      .select(projection)
      .sort(sort)
      .limit(limit)
      .lean();

    const nextCursor =
      sortMode === "newest" && templates.length
        ? String(templates[templates.length - 1]._id)
        : null;

    const hasMore = sortMode === "newest" ? templates.length === limit : false;

    return res.status(200).json({
      message: "Engagement types fetched.",
      templates,
      nextCursor,
      hasMore,
      count: templates.length,
    });
  } catch (err) {
    return res.status(500).json({
      message: "Server error in listEngagementTemplates.",
      error: err.message,
    });
  }
};

/**
 * ✅ Get one engagement template
 * GET /engagement-templates/:id
 */
export const getEngagementTemplateById = async (req, res) => {
  try {
    const tpl = await EngagementTemplate.findById(req.params.id)
      .select("title subEngagements isActive createdAt updatedAt createdBy")
      .lean();

    if (!tpl) return res.status(404).json({ message: "Engagement type not found." });

    return res
      .status(200)
      .json({ message: "Engagement type fetched.", template: tpl });
  } catch (err) {
    if (err?.name === "CastError") {
      return res.status(400).json({ message: "Invalid engagement type id." });
    }
    return res.status(500).json({
      message: "Server error in getEngagementTemplateById.",
      error: err.message,
    });
  }
};

/**
 * ✅ ADMIN: Update engagement template
 * PATCH /engagement-templates/:id
 * body: { title?, subEngagements?, isActive? }
 */
export const updateEngagementTemplate = async (req, res) => {
  try {
    if (!isAdminOrSuperAdmin(req)) {
      return res
        .status(403)
        .json({ message: "Only admin/superadmin can update engagement types." });
    }

    const update = {};

    if (req.body.title !== undefined) {
      const t = String(req.body.title ?? "").trim();
      if (!t) return res.status(400).json({ message: "title cannot be empty." });
      update.title = t;
    }

    if (req.body.subEngagements !== undefined) {
      const { subEngagements, error } = normalizeSubEngagements(
        req.body.subEngagements
      );
      if (error) return res.status(400).json({ message: error });
      update.subEngagements = subEngagements;
    }

    if (req.body.isActive !== undefined) {
      update.isActive = Boolean(req.body.isActive);
    }

    const tpl = await EngagementTemplate.findByIdAndUpdate(req.params.id, update, {
      new: true,
      runValidators: true,
    })
      .select("title subEngagements isActive createdAt updatedAt")
      .lean();

    if (!tpl) return res.status(404).json({ message: "Engagement type not found." });

    return res.status(200).json({ message: "Engagement type updated.", template: tpl });
  } catch (err) {
    if (err?.name === "CastError") {
      return res.status(400).json({ message: "Invalid engagement type id." });
    }

    const dup = handleMongoDuplicateKey(err);
    if (dup) return res.status(409).json(dup);

    return res.status(500).json({
      message: "Server error in updateEngagementTemplate.",
      error: err.message,
    });
  }
};

/**
 * ✅ ADMIN: Delete engagement template
 * DELETE /engagement-templates/:id
 */
export const deleteEngagementTemplate = async (req, res) => {
  try {
    if (!isAdminOrSuperAdmin(req)) {
      return res
        .status(403)
        .json({ message: "Only admin/superadmin can delete engagement types." });
    }

    const deleted = await EngagementTemplate.findByIdAndDelete(req.params.id)
      .select("_id")
      .lean();

    if (!deleted) return res.status(404).json({ message: "Engagement type not found." });

    return res.status(200).json({ message: "Engagement type deleted." });
  } catch (err) {
    if (err?.name === "CastError") {
      return res.status(400).json({ message: "Invalid engagement type id." });
    }
    return res.status(500).json({
      message: "Server error in deleteEngagementTemplate.",
      error: err.message,
    });
  }
};
