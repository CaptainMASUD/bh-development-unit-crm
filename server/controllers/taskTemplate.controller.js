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

const normalizeSubtitleTexts = (subtitles) => {
  if (subtitles === undefined) return { texts: [] };
  if (!Array.isArray(subtitles)) return { error: "subtitles must be an array." };
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

  // de-dupe case-insensitive keep order
  const seen = new Set();
  const out = [];
  for (const t of arr) {
    const k = t.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(t);
  }

  return { texts: out };
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

    const { texts, error } = normalizeSubtitleTexts(req.body.subtitles);
    if (error) return res.status(400).json({ message: error });

    const subtitles = texts.map((t) => ({ text: t, files: [] }));

    const tpl = await TaskTemplate.create({
      title,
      subtitles,
      createdBy: req.user._id,
      isActive: true,
    });

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
 * GET /task-templates
 */
export const listTaskTemplates = async (req, res) => {
  try {
    const active = String(req.query.active ?? "true") === "true";
    const qText = String(req.query.q ?? "").trim();
    const sortMode = String(req.query.sort ?? "title");
    const limit = clampInt(req.query.limit, 1, 200, 200);

    const filter = {};
    if (active) filter.isActive = true;
    if (qText) filter.$text = { $search: qText };

    const projection = qText
      ? { score: { $meta: "textScore" }, title: 1, subtitles: 1, isActive: 1, createdAt: 1, updatedAt: 1 }
      : { title: 1, subtitles: 1, isActive: 1, createdAt: 1, updatedAt: 1 };

    let sort = { title: 1 };
    if (sortMode === "newest") sort = { _id: -1 };
    if (qText) sort = { score: { $meta: "textScore" }, title: 1 };

    const templates = await TaskTemplate.find(filter)
      .collation({ locale: "en", strength: 2 })
      .select(projection)
      .sort(sort)
      .limit(limit)
      .lean();

    return res.status(200).json({
      message: "Templates fetched.",
      templates,
      count: templates.length,
    });
  } catch (err) {
    return res.status(500).json({ message: "Server error in listTaskTemplates.", error: err.message });
  }
};

/**
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
    if (err?.name === "CastError") return res.status(400).json({ message: "Invalid template id." });
    return res.status(500).json({ message: "Server error in getTaskTemplateById.", error: err.message });
  }
};

/**
 * ✅ ADMIN: Update template
 * PATCH /task-templates/:id
 * body: { title?, subtitles?, isActive? }
 *
 * ✅ FIX: If subtitles sent as strings, preserve existing subtitle _id and files by INDEX.
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

    if (req.body.isActive !== undefined) {
      update.isActive = Boolean(req.body.isActive);
    }

    // If subtitles provided: preserve files by index
    if (req.body.subtitles !== undefined) {
      const { texts, error } = normalizeSubtitleTexts(req.body.subtitles);
      if (error) return res.status(400).json({ message: error });

      const existing = await TaskTemplate.findById(req.params.id).select("subtitles").lean();
      if (!existing) return res.status(404).json({ message: "Template not found." });

      const oldSubs = Array.isArray(existing.subtitles) ? existing.subtitles : [];
      const merged = texts.map((text, idx) => {
        const old = oldSubs[idx];
        if (old) {
          return {
            _id: old._id, // ✅ preserve same subtitle id
            text,
            files: Array.isArray(old.files) ? old.files : [], // ✅ preserve files
          };
        }
        return { text, files: [] };
      });

      update.subtitles = merged;
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
    if (err?.name === "CastError") return res.status(400).json({ message: "Invalid template id." });

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
    if (err?.name === "CastError") return res.status(400).json({ message: "Invalid template id." });
    return res.status(500).json({ message: "Server error in deleteTaskTemplate.", error: err.message });
  }
};

// ------------------------------------
// ✅ SUBTITLE FILES CRUD (ADMIN)
// ------------------------------------

// GET /task-templates/:id/subtitles/:subtitleId/files
export const listTemplateSubtitleFiles = async (req, res) => {
  try {
    const { id, subtitleId } = req.params;

    const tpl = await TaskTemplate.findById(id).select("subtitles").lean();
    if (!tpl) return res.status(404).json({ message: "Template not found." });

    const sub = (tpl.subtitles || []).find((s) => String(s._id) === String(subtitleId));
    if (!sub) return res.status(404).json({ message: "Subtitle not found." });

    return res.status(200).json({
      message: "Subtitle files fetched.",
      files: sub.files || [],
      count: (sub.files || []).length,
    });
  } catch (err) {
    if (err?.name === "CastError") return res.status(400).json({ message: "Invalid id." });
    return res.status(500).json({ message: "Server error in listTemplateSubtitleFiles.", error: err.message });
  }
};

// POST /task-templates/:id/subtitles/:subtitleId/files
export const addTemplateSubtitleFile = async (req, res) => {
  try {
    if (!isAdminOrSuperAdmin(req)) {
      return res.status(403).json({ message: "Only admin/superadmin can add subtitle files." });
    }

    const { id, subtitleId } = req.params;
    const { key, url, name, type, size } = req.body;

    if (!key || !url || !name) {
      return res.status(400).json({ message: "key, url and name are required." });
    }

    const cleanName = String(name).trim();

    const fileDoc = {
      key: String(key).trim(),
      url: String(url).trim(),
      name: cleanName,
      nameLower: cleanName.toLowerCase(), // ✅ FIX
      type: type ? String(type).trim() : "",
      size: size !== undefined ? Number(size) : undefined,
      uploadedAt: new Date(),
    };

    const updated = await TaskTemplate.findOneAndUpdate(
      { _id: id, "subtitles._id": subtitleId },
      { $push: { "subtitles.$.files": fileDoc } },
      { new: true, runValidators: true }
    )
      .select("title subtitles isActive createdAt updatedAt")
      .lean();

    if (!updated) return res.status(404).json({ message: "Template or subtitle not found." });

    return res.status(201).json({
      message: "File attached to subtitle.",
      template: updated,
    });
  } catch (err) {
    if (err?.name === "CastError") return res.status(400).json({ message: "Invalid id." });
    return res.status(500).json({ message: "Server error in addTemplateSubtitleFile.", error: err.message });
  }
};

// PATCH /task-templates/:id/subtitles/:subtitleId/files/:fileId  (rename)
export const renameTemplateSubtitleFile = async (req, res) => {
  try {
    if (!isAdminOrSuperAdmin(req)) {
      return res.status(403).json({ message: "Only admin/superadmin can rename subtitle files." });
    }

    const { id, subtitleId, fileId } = req.params;
    const name = String(req.body.name ?? "").trim();
    if (!name) return res.status(400).json({ message: "name is required." });

    const updated = await TaskTemplate.findOneAndUpdate(
      { _id: id },
      {
        $set: {
          "subtitles.$[s].files.$[f].name": name,
          "subtitles.$[s].files.$[f].nameLower": name.toLowerCase(), // ✅ FIX
        },
      },
      {
        new: true,
        runValidators: true,
        arrayFilters: [{ "s._id": subtitleId }, { "f._id": fileId }],
      }
    )
      .select("title subtitles isActive createdAt updatedAt")
      .lean();

    if (!updated) return res.status(404).json({ message: "Template not found." });

    const sub = (updated.subtitles || []).find((s) => String(s._id) === String(subtitleId));
    const file = sub?.files?.find((f) => String(f._id) === String(fileId));
    if (!file) return res.status(404).json({ message: "Subtitle or file not found." });

    return res.status(200).json({ message: "File renamed.", template: updated });
  } catch (err) {
    if (err?.name === "CastError") return res.status(400).json({ message: "Invalid id." });
    return res.status(500).json({ message: "Server error in renameTemplateSubtitleFile.", error: err.message });
  }
};

// PATCH /task-templates/:id/subtitles/:subtitleId/files/:fileId/replace
export const replaceTemplateSubtitleFile = async (req, res) => {
  try {
    if (!isAdminOrSuperAdmin(req)) {
      return res.status(403).json({ message: "Only admin/superadmin can replace subtitle files." });
    }

    const { id, subtitleId, fileId } = req.params;
    const { key, url, name, type, size } = req.body;

    if (!key || !url || !name) {
      return res.status(400).json({ message: "key, url and name are required." });
    }

    const cleanName = String(name).trim();

    const updated = await TaskTemplate.findOneAndUpdate(
      { _id: id },
      {
        $set: {
          "subtitles.$[s].files.$[f].key": String(key).trim(),
          "subtitles.$[s].files.$[f].url": String(url).trim(),
          "subtitles.$[s].files.$[f].name": cleanName,
          "subtitles.$[s].files.$[f].nameLower": cleanName.toLowerCase(), // ✅ FIX
          "subtitles.$[s].files.$[f].type": type ? String(type).trim() : "",
          "subtitles.$[s].files.$[f].size": size !== undefined ? Number(size) : undefined,
          "subtitles.$[s].files.$[f].uploadedAt": new Date(),
        },
      },
      {
        new: true,
        runValidators: true,
        arrayFilters: [{ "s._id": subtitleId }, { "f._id": fileId }],
      }
    )
      .select("title subtitles isActive createdAt updatedAt")
      .lean();

    if (!updated) return res.status(404).json({ message: "Template not found." });

    const sub = (updated.subtitles || []).find((s) => String(s._id) === String(subtitleId));
    const file = sub?.files?.find((f) => String(f._id) === String(fileId));
    if (!file) return res.status(404).json({ message: "Subtitle or file not found." });

    return res.status(200).json({ message: "File replaced.", template: updated });
  } catch (err) {
    if (err?.name === "CastError") return res.status(400).json({ message: "Invalid id." });
    return res.status(500).json({ message: "Server error in replaceTemplateSubtitleFile.", error: err.message });
  }
};

// DELETE /task-templates/:id/subtitles/:subtitleId/files/:fileId
export const deleteTemplateSubtitleFile = async (req, res) => {
  try {
    if (!isAdminOrSuperAdmin(req)) {
      return res.status(403).json({ message: "Only admin/superadmin can delete subtitle files." });
    }

    const { id, subtitleId, fileId } = req.params;

    // ✅ first check existence so we can return proper 404 if fileId not found
    const tpl = await TaskTemplate.findById(id).select("subtitles").lean();
    if (!tpl) return res.status(404).json({ message: "Template not found." });

    const sub = (tpl.subtitles || []).find((s) => String(s._id) === String(subtitleId));
    if (!sub) return res.status(404).json({ message: "Subtitle not found." });

    const existed = (sub.files || []).some((f) => String(f._id) === String(fileId));
    if (!existed) return res.status(404).json({ message: "File not found." });

    const updated = await TaskTemplate.findOneAndUpdate(
      { _id: id, "subtitles._id": subtitleId },
      { $pull: { "subtitles.$.files": { _id: fileId } } },
      { new: true, runValidators: true }
    )
      .select("title subtitles isActive createdAt updatedAt")
      .lean();

    if (!updated) return res.status(404).json({ message: "Template or subtitle not found." });

    return res.status(200).json({ message: "File removed from subtitle.", template: updated });
  } catch (err) {
    if (err?.name === "CastError") return res.status(400).json({ message: "Invalid id." });
    return res.status(500).json({ message: "Server error in deleteTemplateSubtitleFile.", error: err.message });
  }
};
