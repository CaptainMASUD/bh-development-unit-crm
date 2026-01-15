// controllers/taskTemplate.controller.js
import mongoose from "mongoose";
import TaskTemplate from "../models/taskTemplate.model.js";

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
  return Math.max(min, Math.min(max, v));
};

const toId = (v) => {
  if (!v) return null;
  try {
    return new mongoose.Types.ObjectId(String(v));
  } catch {
    return null;
  }
};

const normalizeSubtitles = (subtitles) => {
  if (subtitles === undefined) return { subtitles: [] };
  if (!Array.isArray(subtitles)) return { error: "subtitles must be an array." };

  // hard safety limit
  if (subtitles.length > 200) return { error: "Too many subtitles (max 200)." };

  const arr = [];
  for (const s of subtitles) {
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

  return { subtitles: normalized };
};

/**
 * ✅ ADMIN: Create template
 * POST /task-templates
 * body: { title, subtitles?: [] }
 */
export const createTaskTemplate = async (req, res) => {
  try {
    if (!isAdminOrSuperAdmin(req)) {
      return res.status(403).json({ message: "Only admin/superadmin can create templates." });
    }

    const title = String(req.body.title ?? "").trim();
    if (!title) return res.status(400).json({ message: "title is required." });

    const { subtitles, error } = normalizeSubtitles(req.body.subtitles);
    if (error) return res.status(400).json({ message: error });

    const tpl = await TaskTemplate.create({
      title,
      subtitles,
      createdBy: req.user._id,
      isActive: true,
    });

    // keep response light
    return res.status(201).json({
      message: "Template created.",
      template: {
        _id: tpl._id,
        title: tpl.title,
        subtitles: tpl.subtitles,
        isActive: tpl.isActive,
        createdAt: tpl.createdAt,
        updatedAt: tpl.updatedAt,
      },
    });
  } catch (err) {
    const dup = handleMongoDuplicateKey(err);
    if (dup) return res.status(409).json(dup);

    return res.status(500).json({ message: "Server error in createTaskTemplate.", error: err.message });
  }
};

/**
 * ✅ List templates (dropdown use)
 * GET /task-templates?active=true&q=searchText&limit=100&cursor=<ObjectId>&sort=title|newest
 *
 * - default sort: title asc (dropdown friendly)
 * - sort=newest supports cursor pagination with _id desc
 */
export const listTaskTemplates = async (req, res) => {
  try {
    const active = String(req.query.active ?? "true") === "true";
    const qText = String(req.query.q ?? "").trim();
    const sortMode = String(req.query.sort ?? "title"); // "title" | "newest"
    const limit = clampInt(req.query.limit, 1, 200, 200);

    const cursorId = req.query.cursor ? toId(req.query.cursor) : null;

    const filter = {};
    if (active) filter.isActive = true;

    // ✅ Fast search using text index when q exists
    // NOTE: this requires taskTemplateSchema.index({ title: "text" })
    if (qText) {
      filter.$text = { $search: qText };
    }

    // ✅ Cursor pagination only applies cleanly to newest sort
    if (sortMode === "newest" && cursorId) {
      filter._id = { $lt: cursorId };
    }

    // projection
    const projection = qText
      ? { score: { $meta: "textScore" }, title: 1, subtitles: 1, isActive: 1, createdAt: 1, updatedAt: 1 }
      : { title: 1, subtitles: 1, isActive: 1, createdAt: 1, updatedAt: 1 };

    // sorting
    let sort = { title: 1 };
    if (sortMode === "newest") sort = { _id: -1 };
    if (qText) sort = { score: { $meta: "textScore" }, title: 1 };

    const templates = await TaskTemplate.find(filter)
      .collation({ locale: "en", strength: 2 }) // keeps title sorting consistent & case-insensitive
      .select(projection)
      .sort(sort)
      .limit(limit)
      .lean();

    // ✅ cursor meta (only meaningful for newest)
    const nextCursor = sortMode === "newest" && templates.length ? String(templates[templates.length - 1]._id) : null;
    const hasMore = sortMode === "newest" ? templates.length === limit : false;

    return res.status(200).json({
      message: "Templates fetched.",
      templates,
      nextCursor,
      hasMore,
      count: templates.length,
    });
  } catch (err) {
    return res.status(500).json({ message: "Server error in listTaskTemplates.", error: err.message });
  }
};

/**
 * ✅ Get one template
 * GET /task-templates/:id
 */
export const getTaskTemplateById = async (req, res) => {
  try {
    const tpl = await TaskTemplate.findById(req.params.id)
      .select("title subtitles isActive createdAt updatedAt createdBy")
      .lean();

    if (!tpl) return res.status(404).json({ message: "Template not found." });

    return res.status(200).json({ message: "Template fetched.", template: tpl });
  } catch (err) {
    if (err?.name === "CastError") {
      return res.status(400).json({ message: "Invalid template id." });
    }
    return res.status(500).json({ message: "Server error in getTaskTemplateById.", error: err.message });
  }
};

/**
 * ✅ ADMIN: Update template
 * PATCH /task-templates/:id
 * body: { title?, subtitles?, isActive? }
 *
 * Optimization:
 * - No extra "exists" query; rely on unique index + duplicate key handling
 */
export const updateTaskTemplate = async (req, res) => {
  try {
    if (!isAdminOrSuperAdmin(req)) {
      return res.status(403).json({ message: "Only admin/superadmin can update templates." });
    }

    const update = {};

    if (req.body.title !== undefined) {
      const t = String(req.body.title ?? "").trim();
      if (!t) return res.status(400).json({ message: "title cannot be empty." });
      update.title = t;
    }

    if (req.body.subtitles !== undefined) {
      const { subtitles, error } = normalizeSubtitles(req.body.subtitles);
      if (error) return res.status(400).json({ message: error });
      update.subtitles = subtitles;
    }

    if (req.body.isActive !== undefined) {
      update.isActive = Boolean(req.body.isActive);
    }

    const tpl = await TaskTemplate.findByIdAndUpdate(req.params.id, update, {
      new: true,
      runValidators: true,
    })
      .select("title subtitles isActive createdAt updatedAt")
      .lean();

    if (!tpl) return res.status(404).json({ message: "Template not found." });

    return res.status(200).json({ message: "Template updated.", template: tpl });
  } catch (err) {
    if (err?.name === "CastError") {
      return res.status(400).json({ message: "Invalid template id." });
    }

    const dup = handleMongoDuplicateKey(err);
    if (dup) return res.status(409).json(dup);

    return res.status(500).json({ message: "Server error in updateTaskTemplate.", error: err.message });
  }
};

/**
 * ✅ ADMIN: Delete template
 * DELETE /task-templates/:id
 */
export const deleteTaskTemplate = async (req, res) => {
  try {
    if (!isAdminOrSuperAdmin(req)) {
      return res.status(403).json({ message: "Only admin/superadmin can delete templates." });
    }

    const deleted = await TaskTemplate.findByIdAndDelete(req.params.id).select("_id").lean();
    if (!deleted) return res.status(404).json({ message: "Template not found." });

    return res.status(200).json({ message: "Template deleted." });
  } catch (err) {
    if (err?.name === "CastError") {
      return res.status(400).json({ message: "Invalid template id." });
    }
    return res.status(500).json({ message: "Server error in deleteTaskTemplate.", error: err.message });
  }
};
