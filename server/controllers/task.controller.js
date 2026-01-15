// controllers/task.controller.js
import mongoose from "mongoose";
import Customer from "../models/customer.model.js";
import User from "../models/user.model.js";
import TaskTemplate from "../models/taskTemplate.model.js";

const { Types } = mongoose;

const ALLOWED_STATUSES = ["pending", "in_progress", "done"];
const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 20;

/* ------------------ helpers ------------------ */

const isAdminOrSuperAdmin = (req) => {
  const role = req?.user?.role ?? req?.role;
  return role === "admin" || role === "superadmin";
};

const toIdString = (x) => {
  if (!x) return null;
  if (typeof x === "object") return String(x._id ?? x.id ?? "");
  return String(x);
};

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

const ensureEmployeesExistFast = async (ids) => {
  const count = await User.countDocuments({ _id: { $in: ids }, role: "employee" });
  return count === ids.length;
};

/**
 * ✅ Accepts:
 * - employeeId (string)
 * - employeeIds (array)
 * - assignedTo (array)
 */
const normalizeEmployeeIds = (body) => {
  const { employeeId, employeeIds, assignedTo } = body;

  let ids = [];

  if (assignedTo !== undefined) {
    if (!Array.isArray(assignedTo)) return { error: "assignedTo must be an array." };
    ids = assignedTo.map(toIdString).filter(Boolean);
  } else if (employeeIds !== undefined) {
    if (!Array.isArray(employeeIds)) return { error: "employeeIds must be an array." };
    ids = employeeIds.map(toIdString).filter(Boolean);
  } else if (employeeId) {
    ids = [toIdString(employeeId)].filter(Boolean);
  } else {
    return { error: "Provide assignedTo (array) or employeeId (single) or employeeIds (multiple)." };
  }

  ids = Array.from(new Set(ids));
  if (ids.length === 0) return { error: "At least 1 employee must be selected." };

  const objIds = ids.map(toObjectIdSafe).filter(Boolean);
  if (objIds.length !== ids.length) return { error: "One or more assignee IDs are invalid." };

  return { ids: objIds };
};

const ensureAssigneesAssignedToCustomerFast = (customerAssignedTo, ids) => {
  const set = new Set((customerAssignedTo || []).map((x) => String(x?._id ?? x)));
  const notAssigned = ids.filter((id) => !set.has(String(id)));
  return { ok: notAssigned.length === 0, notAssigned };
};

const isTaskAssignedToUser = (task, userId) => {
  const uid = String(userId);
  const assigned = Array.isArray(task?.assignedTo) ? task.assignedTo : [];
  return assigned.some((x) => String(x?._id ?? x) === uid);
};

const customerAccessForEmployee = (customer, userId) => {
  if (!customer) return false;
  const uid = String(userId);

  const createdBy = String(customer.createdBy?._id ?? customer.createdBy ?? "");
  const assigned = Array.isArray(customer.assignedTo) ? customer.assignedTo : [];
  const assignedIds = assigned.map((x) => String(x?._id ?? x));

  return createdBy === uid || assignedIds.includes(uid);
};

/**
 * ✅ NEW: normalize task subtitles (manual create/update)
 * Keeps existing files/notes by:
 *  - matching _id if provided
 *  - else matching text (case-insensitive) if _id not provided
 *
 * Input accepts:
 * - array of strings
 * - array of { text }
 * - array of { _id?, text, files?, notes? } (admin could send full)
 */
const normalizeManualSubtitlesV2 = (subtitles, existingSubtitles = []) => {
  if (subtitles === undefined || subtitles === null) return { subtitles: [] };
  if (!Array.isArray(subtitles)) return { error: "subtitles must be an array." };
  if (subtitles.length > 200) return { error: "Too many subtitles (max 200)." };

  const byId = new Map((existingSubtitles || []).map((s) => [String(s?._id ?? ""), s]));
  const byText = new Map(
    (existingSubtitles || [])
      .map((s) => {
        const t = String(s?.text ?? "").trim();
        return t ? [t.toLowerCase(), s] : null;
      })
      .filter(Boolean)
  );

  const raw = [];

  for (const s of subtitles) {
    // string
    if (typeof s === "string") {
      const t = s.trim();
      if (!t) continue;

      const prev = byText.get(t.toLowerCase());
      raw.push({
        text: t,
        files: prev?.files || [],
        notes: prev?.notes || [],
      });
      continue;
    }

    // object
    if (s && typeof s === "object") {
      const t = String(s.text ?? "").trim();
      if (!t) continue;

      const sid = s._id ? String(s._id) : null;
      const prev = sid ? byId.get(sid) : byText.get(t.toLowerCase());

      raw.push({
        text: t,
        files: Array.isArray(s.files) ? s.files : prev?.files || [],
        notes: Array.isArray(s.notes) ? s.notes : prev?.notes || [],
      });
    }
  }

  // dedupe by text (case-insensitive) keep order
  const seen = new Set();
  const normalized = [];

  for (const item of raw) {
    const key = String(item.text).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    normalized.push({
      text: item.text,
      files: Array.isArray(item.files) ? item.files : [],
      notes: Array.isArray(item.notes) ? item.notes : [],
    });
  }

  return { subtitles: normalized };
};

/**
 * ✅ NEW: normalize files input (single or multiple)
 * Supports:
 * - single: { key, url, originalName, ... }
 * - multi:  { files: [ { key, url, originalName, ... }, ... ] }
 *
 * NOTE: We manually add _id in controller (important for "note under file" feature).
 */
const normalizeFilesInput = (body) => {
  const toFile = (f) => {
    const key = String(f?.key ?? "").trim();
    const url = String(f?.url ?? "").trim(); // keep required here (recommended)
    const originalName = String(f?.originalName ?? "").trim();

    if (!key || !originalName) return null;

    return {
      key,
      url, // can be empty if you store private; but frontend usually sends it
      originalName,
      displayName: f?.displayName ? String(f.displayName).trim() : "",
      mimeType: f?.mimeType ? String(f.mimeType).trim() : "",
      size: typeof f?.size === "number" ? f.size : 0,
    };
  };

  // multiple
  if (Array.isArray(body?.files)) {
    const list = body.files.map(toFile).filter(Boolean);
    if (list.length === 0) return { error: "files array is empty or invalid. key + originalName required." };
    return { files: list };
  }

  // single
  const single = toFile(body);
  if (!single) return { error: "Invalid file. key + originalName required." };
  return { files: [single] };
};

/**
 * ✅ NEW: build subtitle note
 * Supports optional fileId (attach note under a specific file)
 */
const buildSubtitleNote = (req, text, fileId = null) => {
  const t = String(text ?? "").trim();
  if (!t) return null;

  return {
    _id: new Types.ObjectId(),
    text: t,
    fileId: fileId || null,
    createdAt: new Date(),
    createdBy: req.user?._id ?? null,
  };
};

/**
 * ✅ Template build:
 * - returns task subtitles with files+notes empty
 */
const buildTaskFromTemplate = async (templateId, selectedSubtitleIds = undefined) => {
  const tpl = await TaskTemplate.findOne({ _id: templateId, isActive: true })
    .select("title subtitles isActive")
    .lean();

  if (!tpl) return { error: "Template not found or inactive." };

  const title = String(tpl.title ?? "").trim();
  if (!title) return { error: "Template title is empty." };

  let subtitles = Array.isArray(tpl.subtitles)
    ? tpl.subtitles
        .map((s) => ({
          _id: String(s?._id ?? ""),
          text: String(s?.text ?? "").trim(),
        }))
        .filter((s) => s.text)
    : [];

  if (Array.isArray(selectedSubtitleIds) && selectedSubtitleIds.length > 0) {
    const allowed = new Set(selectedSubtitleIds.map(String));
    subtitles = subtitles.filter((s) => allowed.has(String(s._id)));
  }

  const subtitleDocs = subtitles.map((s) => ({
    text: s.text,
    files: [],
    notes: [],
  }));

  return { title, subtitles: subtitleDocs, templateId: tpl._id };
};

/* =========================================================
   ✅ TASKS LIST (cursor pagination)
   GET /customers/:customerId/tasks?limit=20&cursor=<taskId>
   - Admin: all
   - Employee: only assigned tasks
========================================================= */
export const getCustomerTasks = async (req, res) => {
  try {
    const customerId = toObjectIdSafe(req.params.customerId);
    if (!customerId) return res.status(400).json({ message: "Invalid customerId." });

    const limit = clampInt(req.query.limit, 1, MAX_LIMIT, DEFAULT_LIMIT);
    const cursor = toObjectIdSafe(req.query.cursor);

    const isAdmin = isAdminOrSuperAdmin(req);
    const uid = toObjectIdSafe(req.user?._id);

    const matchTask = {};
    if (cursor) matchTask["crmTasks._id"] = { $lt: cursor };

    if (!isAdmin && uid) {
      matchTask["crmTasks.assignedTo"] = uid;
    }

    const pipeline = [
      { $match: { _id: customerId } },
      { $unwind: "$crmTasks" },
      { $match: matchTask },
      { $sort: { "crmTasks._id": -1 } },
      { $limit: limit + 1 },
      { $replaceRoot: { newRoot: "$crmTasks" } },
      {
        $project: {
          _id: 1,
          title: 1,
          subtitles: 1, // ✅ files + notes live here now
          templateId: 1,
          description: 1,
          status: 1,
          dueAt: 1,
          completedAt: 1,
          createdBy: 1,
          assignedTo: 1,
          reminders: 1,
          createdAt: 1,
          updatedAt: 1,
        },
      },
    ];

    const rows = await Customer.aggregate(pipeline);

    const hasMore = rows.length > limit;
    const tasks = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore ? String(tasks[tasks.length - 1]._id) : null;

    return res.status(200).json({
      message: "Tasks fetched.",
      tasks,
      hasMore,
      nextCursor,
      count: tasks.length,
    });
  } catch (err) {
    return res.status(500).json({ message: "Server error in getCustomerTasks.", error: err.message });
  }
};

/* =========================================================
   ✅ CREATE TASK (Admin only)
   POST /customers/:customerId/tasks
========================================================= */
export const addTask = async (req, res) => {
  try {
    if (!isAdminOrSuperAdmin(req)) {
      return res.status(403).json({ message: "Only admin/superadmin can create tasks." });
    }

    const customerId = toObjectIdSafe(req.params.customerId);
    if (!customerId) return res.status(400).json({ message: "Invalid customerId." });

    const { description, dueAt, status, templateId, selectedSubtitleIds } = req.body;

    const finalStatus = status ? String(status) : "pending";
    if (!ALLOWED_STATUSES.includes(finalStatus)) {
      return res.status(400).json({ message: "Invalid status value." });
    }

    const { ids, error } = normalizeEmployeeIds(req.body);
    if (error) return res.status(400).json({ message: error });

    const okEmployees = await ensureEmployeesExistFast(ids);
    if (!okEmployees) return res.status(404).json({ message: "One or more employees not found." });

    const customer = await Customer.findById(customerId).select("_id assignedTo").lean();
    if (!customer) return res.status(404).json({ message: "Customer not found." });

    const check = ensureAssigneesAssignedToCustomerFast(customer.assignedTo, ids);
    if (!check.ok) {
      return res.status(400).json({
        message: "All task assignees must be assigned to this customer first.",
        notAssigned: check.notAssigned,
      });
    }

    let taskTitle = "";
    let taskSubtitles = [];
    let usedTemplateId = null;

    if (templateId) {
      const built = await buildTaskFromTemplate(templateId, selectedSubtitleIds);
      if (built.error) return res.status(404).json({ message: built.error });

      taskTitle = built.title;
      taskSubtitles = built.subtitles;
      usedTemplateId = built.templateId;
    } else {
      const title = String(req.body.title ?? "").trim();
      if (!title) return res.status(400).json({ message: "templateId (preferred) or title is required." });

      const { subtitles, error: subErr } = normalizeManualSubtitlesV2(req.body.subtitles);
      if (subErr) return res.status(400).json({ message: subErr });

      taskTitle = title;
      taskSubtitles = subtitles;
      usedTemplateId = null;
    }

    const taskId = new Types.ObjectId();
    const now = new Date();

    const taskDoc = {
      _id: taskId,
      title: taskTitle,
      subtitles: taskSubtitles,
      templateId: usedTemplateId,

      description: description ? String(description).trim() : "",
      status: finalStatus,
      dueAt: dueAt ? new Date(dueAt) : null,
      completedAt: finalStatus === "done" ? now : null,

      createdBy: req.user._id,
      assignedTo: ids,
      reminders: [],
      createdAt: now,
    };

    await Customer.updateOne({ _id: customerId }, { $push: { crmTasks: taskDoc } });

    return res.status(201).json({ message: "Task created.", task: taskDoc });
  } catch (err) {
    return res.status(500).json({ message: "Server error in addTask.", error: err.message });
  }
};

/* =========================================================
   ✅ ADMIN UPDATE TASK
   PATCH /customers/:customerId/tasks/:taskId
========================================================= */
export const updateTaskByAdmin = async (req, res) => {
  try {
    if (!isAdminOrSuperAdmin(req)) {
      return res.status(403).json({ message: "Only admin/superadmin can update tasks." });
    }

    const customerId = toObjectIdSafe(req.params.customerId);
    const taskId = toObjectIdSafe(req.params.taskId);
    if (!customerId || !taskId) return res.status(400).json({ message: "Invalid ids." });

    const {
      title,
      subtitles,
      description,
      status,
      dueAt,
      employeeId,
      employeeIds,
      assignedTo,
      templateId,
      selectedSubtitleIds,
    } = req.body;

    if (status !== undefined && !ALLOWED_STATUSES.includes(String(status))) {
      return res.status(400).json({ message: "Invalid status value." });
    }

    const found = await Customer.findOne(
      { _id: customerId, "crmTasks._id": taskId },
      { assignedTo: 1, "crmTasks.$": 1 }
    ).lean();

    if (!found) return res.status(404).json({ message: "Customer or task not found." });

    const existingTask = found.crmTasks?.[0];
    if (!existingTask) return res.status(404).json({ message: "Task not found." });

    const $set = {};

    if (description !== undefined) $set["crmTasks.$.description"] = String(description || "").trim();
    if (dueAt !== undefined) $set["crmTasks.$.dueAt"] = dueAt ? new Date(dueAt) : null;

    // assignments update
    const wantsAssignmentUpdate =
      assignedTo !== undefined || employeeId !== undefined || employeeIds !== undefined;

    if (wantsAssignmentUpdate) {
      const { ids, error } = normalizeEmployeeIds(req.body);
      if (error) return res.status(400).json({ message: error });

      const okEmployees = await ensureEmployeesExistFast(ids);
      if (!okEmployees) return res.status(404).json({ message: "One or more employees not found." });

      const check = ensureAssigneesAssignedToCustomerFast(found.assignedTo, ids);
      if (!check.ok) {
        return res.status(400).json({
          message: "All task assignees must be assigned to this customer first.",
          notAssigned: check.notAssigned,
        });
      }

      $set["crmTasks.$.assignedTo"] = ids;
    }

    // template change (this resets subtitles/files/notes because it's a new snapshot)
    if (templateId !== undefined) {
      if (templateId) {
        const built = await buildTaskFromTemplate(templateId, selectedSubtitleIds);
        if (built.error) return res.status(404).json({ message: built.error });

        $set["crmTasks.$.title"] = built.title;
        $set["crmTasks.$.subtitles"] = built.subtitles;
        $set["crmTasks.$.templateId"] = built.templateId;
      } else {
        // switch to manual
        $set["crmTasks.$.templateId"] = null;

        if (title !== undefined) {
          const t = String(title ?? "").trim();
          if (!t) return res.status(400).json({ message: "title cannot be empty." });
          $set["crmTasks.$.title"] = t;
        }

        if (subtitles !== undefined) {
          const { subtitles: norm, error: subErr } = normalizeManualSubtitlesV2(
            subtitles,
            existingTask.subtitles
          );
          if (subErr) return res.status(400).json({ message: subErr });
          $set["crmTasks.$.subtitles"] = norm;
        }
      }
    } else {
      // manual updates only if already manual
      if (!existingTask.templateId) {
        if (title !== undefined) {
          const t = String(title ?? "").trim();
          if (!t) return res.status(400).json({ message: "title cannot be empty." });
          $set["crmTasks.$.title"] = t;
        }

        if (subtitles !== undefined) {
          const { subtitles: norm, error: subErr } = normalizeManualSubtitlesV2(
            subtitles,
            existingTask.subtitles
          );
          if (subErr) return res.status(400).json({ message: subErr });
          $set["crmTasks.$.subtitles"] = norm;
        }
      }
    }

    if (status !== undefined) {
      const s = String(status);
      $set["crmTasks.$.status"] = s;
      $set["crmTasks.$.completedAt"] = s === "done" ? new Date() : null;
    }

    if (Object.keys($set).length === 0) {
      return res.status(200).json({ message: "No changes.", task: existingTask });
    }

    await Customer.updateOne({ _id: customerId, "crmTasks._id": taskId }, { $set });

    const updated = await Customer.findOne(
      { _id: customerId, "crmTasks._id": taskId },
      { "crmTasks.$": 1 }
    ).lean();

    return res.status(200).json({ message: "Task updated.", task: updated?.crmTasks?.[0] ?? null });
  } catch (err) {
    return res.status(500).json({ message: "Server error in updateTaskByAdmin.", error: err.message });
  }
};

/* =========================================================
   ✅ EMPLOYEE STATUS UPDATE (employee/admin allowed)
   PATCH /customers/:customerId/tasks/:taskId/status
========================================================= */
export const updateTaskStatus = async (req, res) => {
  try {
    const customerId = toObjectIdSafe(req.params.customerId);
    const taskId = toObjectIdSafe(req.params.taskId);
    if (!customerId || !taskId) return res.status(400).json({ message: "Invalid ids." });

    const { status } = req.body;
    if (!ALLOWED_STATUSES.includes(String(status))) {
      return res.status(400).json({ message: "Invalid status value." });
    }

    const found = await Customer.findOne(
      { _id: customerId, "crmTasks._id": taskId },
      { createdBy: 1, assignedTo: 1, "crmTasks.$": 1 }
    ).lean();

    if (!found) return res.status(404).json({ message: "Customer or task not found." });

    // if not admin, must have customer access
    if (!isAdminOrSuperAdmin(req)) {
      if (!customerAccessForEmployee(found, req.user._id)) {
        return res.status(403).json({ message: "No access to this customer." });
      }
    }

    const task = found.crmTasks?.[0];
    if (!task) return res.status(404).json({ message: "Task not found." });

    // employee must be assigned to the task
    if (!isAdminOrSuperAdmin(req) && req.user.role === "employee") {
      if (!isTaskAssignedToUser(task, req.user._id)) {
        return res.status(403).json({ message: "You are not assigned to this task." });
      }
    }

    const s = String(status);
    await Customer.updateOne(
      { _id: customerId, "crmTasks._id": taskId },
      {
        $set: {
          "crmTasks.$.status": s,
          "crmTasks.$.completedAt": s === "done" ? new Date() : null,
        },
      }
    );

    const updated = await Customer.findOne(
      { _id: customerId, "crmTasks._id": taskId },
      { "crmTasks.$": 1 }
    ).lean();

    return res.status(200).json({ message: "Task status updated.", task: updated?.crmTasks?.[0] ?? null });
  } catch (err) {
    return res.status(500).json({ message: "Server error in updateTaskStatus.", error: err.message });
  }
};

/* =========================================================
   ✅ ADD FILE(S) UNDER A SUBTITLE (+ optional note)
   POST /customers/:customerId/tasks/:taskId/subtitles/:subtitleId/files
   body:
     - single: { key, url, originalName, ... , note?: "optional", attachNoteTo?: "subtitle"|"file" }
     - multi:  { files: [{...},{...}], note?: "optional", attachNoteTo?: "subtitle"|"file" }
   Rules:
     - employee allowed only if assigned to task
     - admin/superadmin allowed
   Note attachment:
     - attachNoteTo="subtitle" (default): adds a note not tied to any file
     - attachNoteTo="file": ties the note to the uploaded file(s)
========================================================= */
export const addSubtitleFiles = async (req, res) => {
  try {
    const customerId = toObjectIdSafe(req.params.customerId);
    const taskId = toObjectIdSafe(req.params.taskId);
    const subtitleId = toObjectIdSafe(req.params.subtitleId);

    if (!customerId || !taskId || !subtitleId) {
      return res.status(400).json({ message: "Invalid ids." });
    }

    // load minimal (customer+task)
    const found = await Customer.findOne(
      { _id: customerId, "crmTasks._id": taskId },
      { createdBy: 1, assignedTo: 1, "crmTasks.$": 1 }
    ).lean();

    if (!found) return res.status(404).json({ message: "Customer or task not found." });

    // if not admin, must have customer access
    if (!isAdminOrSuperAdmin(req)) {
      if (!customerAccessForEmployee(found, req.user._id)) {
        return res.status(403).json({ message: "No access to this customer." });
      }
    }

    const task = found.crmTasks?.[0];
    if (!task) return res.status(404).json({ message: "Task not found." });

    // employee must be assigned to task
    if (!isAdminOrSuperAdmin(req) && req.user.role === "employee") {
      if (!isTaskAssignedToUser(task, req.user._id)) {
        return res.status(403).json({ message: "You are not assigned to this task." });
      }
    }

    const subtitle = (task.subtitles || []).find((s) => String(s?._id) === String(subtitleId));
    if (!subtitle) return res.status(404).json({ message: "Subtitle not found." });

    // normalize files
    const { files, error } = normalizeFilesInput(req.body);
    if (error) return res.status(400).json({ message: error });

    // IMPORTANT: because we are using updateOne ($push), Mongo won't auto-generate subdoc _id
    // so we create _id ourselves so "note under file" works.
    const readyFiles = files.map((f) => ({
      _id: new Types.ObjectId(),
      ...f,
      uploadedBy: req.user?._id ?? null,
      uploadedAt: new Date(),
    }));

    // optional note
    const noteText = String(req.body?.note ?? "").trim();
    const attachNoteTo = String(req.body?.attachNoteTo ?? "subtitle"); // subtitle | file

    let notesToPush = [];
    if (noteText) {
      if (attachNoteTo === "file") {
        // tie note to each uploaded file
        notesToPush = readyFiles.map((rf) => buildSubtitleNote(req, noteText, rf._id));
      } else {
        // subtitle-level note
        notesToPush = [buildSubtitleNote(req, noteText, null)];
      }
      notesToPush = notesToPush.filter(Boolean);
    }

    const update = {
      $push: {
        "crmTasks.$[t].subtitles.$[s].files": { $each: readyFiles },
      },
    };

    if (notesToPush.length) {
      update.$push["crmTasks.$[t].subtitles.$[s].notes"] = { $each: notesToPush };
    }

    await Customer.updateOne(
      { _id: customerId },
      update,
      { arrayFilters: [{ "t._id": taskId }, { "s._id": subtitleId }] }
    );

    return res.status(201).json({
      message: "Files added under subtitle.",
      files: readyFiles,
      notesAdded: notesToPush.length,
    });
  } catch (err) {
    return res.status(500).json({ message: "Server error in addSubtitleFiles.", error: err.message });
  }
};

/* =========================================================
   ✅ ADD NOTE UNDER A SUBTITLE (admin + employee)
   POST /customers/:customerId/tasks/:taskId/subtitles/:subtitleId/notes
   body: { text: "...", fileId?: "<fileSubdocId>" }
   Rules:
     - if fileId present => note becomes "under that file"
========================================================= */
export const addSubtitleNote = async (req, res) => {
  try {
    const customerId = toObjectIdSafe(req.params.customerId);
    const taskId = toObjectIdSafe(req.params.taskId);
    const subtitleId = toObjectIdSafe(req.params.subtitleId);

    if (!customerId || !taskId || !subtitleId) {
      return res.status(400).json({ message: "Invalid ids." });
    }

    const text = String(req.body?.text ?? "").trim();
    if (!text) return res.status(400).json({ message: "text is required." });

    const fileId = req.body?.fileId ? toObjectIdSafe(req.body.fileId) : null;
    if (req.body?.fileId && !fileId) return res.status(400).json({ message: "Invalid fileId." });

    const found = await Customer.findOne(
      { _id: customerId, "crmTasks._id": taskId },
      { createdBy: 1, assignedTo: 1, "crmTasks.$": 1 }
    ).lean();

    if (!found) return res.status(404).json({ message: "Customer or task not found." });

    // if not admin, must have customer access
    if (!isAdminOrSuperAdmin(req)) {
      if (!customerAccessForEmployee(found, req.user._id)) {
        return res.status(403).json({ message: "No access to this customer." });
      }
    }

    const task = found.crmTasks?.[0];
    if (!task) return res.status(404).json({ message: "Task not found." });

    // employee must be assigned to task
    if (!isAdminOrSuperAdmin(req) && req.user.role === "employee") {
      if (!isTaskAssignedToUser(task, req.user._id)) {
        return res.status(403).json({ message: "You are not assigned to this task." });
      }
    }

    const subtitle = (task.subtitles || []).find((s) => String(s?._id) === String(subtitleId));
    if (!subtitle) return res.status(404).json({ message: "Subtitle not found." });

    // if fileId provided, ensure it exists inside this subtitle
    if (fileId) {
      const ok = (subtitle.files || []).some((f) => String(f?._id) === String(fileId));
      if (!ok) return res.status(404).json({ message: "fileId not found inside this subtitle." });
    }

    const noteObj = buildSubtitleNote(req, text, fileId);
    if (!noteObj) return res.status(400).json({ message: "Invalid note." });

    await Customer.updateOne(
      { _id: customerId },
      { $push: { "crmTasks.$[t].subtitles.$[s].notes": noteObj } },
      { arrayFilters: [{ "t._id": taskId }, { "s._id": subtitleId }] }
    );

    return res.status(201).json({ message: "Note added under subtitle.", note: noteObj });
  } catch (err) {
    return res.status(500).json({ message: "Server error in addSubtitleNote.", error: err.message });
  }
};

/* =========================================================
   ✅ DELETE TASK (admin/superadmin)
   DELETE /customers/:customerId/tasks/:taskId
========================================================= */
export const deleteTask = async (req, res) => {
  try {
    if (!isAdminOrSuperAdmin(req)) {
      return res.status(403).json({ message: "Only admin/superadmin can delete tasks." });
    }

    const customerId = toObjectIdSafe(req.params.customerId);
    const taskId = toObjectIdSafe(req.params.taskId);
    if (!customerId || !taskId) return res.status(400).json({ message: "Invalid ids." });

    const r = await Customer.updateOne({ _id: customerId }, { $pull: { crmTasks: { _id: taskId } } });

    if (r.matchedCount === 0) return res.status(404).json({ message: "Customer not found." });
    return res.status(200).json({ message: "Task deleted." });
  } catch (err) {
    return res.status(500).json({ message: "Server error in deleteTask.", error: err.message });
  }
};

/* =========================================================
   ✅ OLD ROUTE (DEPRECATED)
   Previously: addTaskFile (task-level files)
========================================================= */
export const addTaskFile = async (req, res) => {
  return res.status(410).json({
    message: "This endpoint is deprecated. Upload files under subtitle instead.",
    newEndpoint: "POST /customers/:customerId/tasks/:taskId/subtitles/:subtitleId/files",
  });
};

/* =========================================================
   ✅ DEADLINE NOTIFICATIONS (unchanged)
========================================================= */

const parseDeadlineQuery = (req) => {
  const now = new Date();
  const windowDays = Math.max(1, Math.min(365, Number(req.query.windowDays ?? 7)));
  const includeOverdue = String(req.query.includeOverdue ?? "true") === "true";
  const limit = Math.max(1, Math.min(500, Number(req.query.limit ?? 100)));
  const windowEnd = new Date(now.getTime() + windowDays * 24 * 60 * 60 * 1000);
  return { now, windowDays, includeOverdue, limit, windowEnd };
};

const buildDeadlineItemsAgg = async ({ req, mode }) => {
  const { now, windowDays, includeOverdue, limit, windowEnd } = parseDeadlineQuery(req);
  const uid = toObjectIdSafe(req.user?._id);

  const matchTask = {
    "crmTasks.dueAt": { $type: "date" },
    "crmTasks.status": { $ne: "done" },
  };

  if (includeOverdue) {
    matchTask.$or = [{ "crmTasks.dueAt": { $lt: windowEnd } }];
  } else {
    matchTask["crmTasks.dueAt"] = { $gte: now, $lte: windowEnd };
  }

  if (mode === "employee" && uid) {
    matchTask["crmTasks.assignedTo"] = uid;
  }

  const pipeline = [
    { $project: { name: 1, companyName: 1, crmTasks: 1 } },
    { $unwind: "$crmTasks" },
    { $match: matchTask },
    {
      $addFields: {
        _dueAt: "$crmTasks.dueAt",
        _overdue: { $lt: ["$crmTasks.dueAt", now] },
      },
    },
    { $sort: { _dueAt: 1 } },
    { $limit: limit },
    {
      $project: {
        _id: 0,
        type: { $cond: ["$_overdue", "overdue", "due_soon"] },
        customerId: "$_id",
        customerName: "$name",
        companyName: "$companyName",
        taskId: "$crmTasks._id",
        title: "$crmTasks.title",
        status: "$crmTasks.status",
        dueAt: "$crmTasks.dueAt",
        assignedTo: "$crmTasks.assignedTo",
      },
    },
  ];

  const items = await Customer.aggregate(pipeline);

  if (mode === "admin") {
    const allIds = new Set();
    for (const it of items) for (const a of it.assignedTo || []) allIds.add(String(a));

    const ids = Array.from(allIds).map(toObjectIdSafe).filter(Boolean);

    const users = await User.find({ _id: { $in: ids }, role: "employee" })
      .select("_id name role")
      .lean();

    const map = new Map(users.map((u) => [String(u._id), u]));

    for (const it of items) {
      it.assignees = (it.assignedTo || []).map((id) => {
        const u = map.get(String(id));
        return u ? { _id: u._id, name: u.name, role: u.role } : { _id: id, name: "Unknown", role: "" };
      });
    }
  }

  return { now, windowDays, includeOverdue, count: items.length, items };
};

export const getDeadlineNotificationsAdmin = async (req, res) => {
  try {
    if (!isAdminOrSuperAdmin(req)) {
      return res.status(403).json({ message: "Only admin/superadmin can view admin notifications." });
    }
    const payload = await buildDeadlineItemsAgg({ req, mode: "admin" });
    return res.status(200).json({ message: "Admin deadline notifications fetched.", ...payload });
  } catch (err) {
    return res.status(500).json({ message: "Server error in getDeadlineNotificationsAdmin.", error: err.message });
  }
};

export const getDeadlineNotificationsEmployee = async (req, res) => {
  try {
    if (isAdminOrSuperAdmin(req)) {
      return res.status(403).json({ message: "This route is for employees only." });
    }
    if (req.user.role !== "employee") {
      return res.status(403).json({ message: "Only employees can view employee notifications." });
    }
    const payload = await buildDeadlineItemsAgg({ req, mode: "employee" });
    return res.status(200).json({ message: "Employee deadline notifications fetched.", ...payload });
  } catch (err) {
    return res.status(500).json({ message: "Server error in getDeadlineNotificationsEmployee.", error: err.message });
  }
};

export const getDeadlineNotificationsAuto = async (req, res) => {
  try {
    if (isAdminOrSuperAdmin(req)) return getDeadlineNotificationsAdmin(req, res);
    if (req.user.role === "employee") return getDeadlineNotificationsEmployee(req, res);
    return res.status(403).json({ message: "Not allowed." });
  } catch (err) {
    return res.status(500).json({ message: "Server error in getDeadlineNotificationsAuto.", error: err.message });
  }
};
