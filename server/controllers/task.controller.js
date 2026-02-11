// controllers/task.controller.js
import mongoose from "mongoose";
import Customer from "../models/customer.model.js";
import User from "../models/user.model.js";
import TaskTemplate from "../models/taskTemplate.model.js";
import ServiceLog from "../models/serviceLog.model.js";

// ✅ OPTIONAL (recommended): delete from S3 when deleting a subtitle file
import s3 from "../config/s3v3.js";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";

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
  const t = Math.trunc(v);
  return Math.max(min, Math.min(max, t));
};

const ensureEmployeesExistFast = async (ids) => {
  const count = await User.countDocuments({
    _id: { $in: ids },
    role: "employee",
    isActive: true,
  });
  return count === ids.length;
};

/**
 * Accepts: employeeId (string) | employeeIds (array) | assignedTo (array)
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
 * resolve rootJobId (max depth=2)
 * NOTE: jobId can now be null (direct task)
 */
const resolveRootJobId = (jobs, jobId) => {
  if (!jobId) return { rootJobId: null, jobNode: null }; // ✅ direct task
  const idStr = String(jobId);
  const node = (jobs || []).find((j) => String(j._id) === idStr);
  if (!node) return { error: "jobId not found under this customer." };

  if (!node.parentJobId) {
    return { rootJobId: node._id, jobNode: node };
  }

  const parent = (jobs || []).find((j) => String(j._id) === String(node.parentJobId));
  if (!parent) return { error: "jobId parentJobId is invalid (parent not found)." };
  if (parent.parentJobId) return { error: "Invalid job tree (parent is not root)." };

  return { rootJobId: parent._id, jobNode: node };
};

/**
 * normalize task subtitles (manual create/update)
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
    if (typeof s === "string") {
      const t = s.trim();
      if (!t) continue;

      const prev = byText.get(t.toLowerCase());
      raw.push({
        text: t,
        templateSubtitleId: prev?.templateSubtitleId ?? null,
        files: prev?.files || [],
        notes: prev?.notes || [],
      });
      continue;
    }

    if (s && typeof s === "object") {
      const t = String(s.text ?? "").trim();
      if (!t) continue;

      const sid = s._id ? String(s._id) : null;
      const prev = sid ? byId.get(sid) : byText.get(t.toLowerCase());

      raw.push({
        text: t,
        templateSubtitleId: s.templateSubtitleId
          ? toObjectIdSafe(s.templateSubtitleId) || null
          : prev?.templateSubtitleId ?? null,
        files: Array.isArray(s.files) ? s.files : prev?.files || [],
        notes: Array.isArray(s.notes) ? s.notes : prev?.notes || [],
      });
    }
  }

  const seen = new Set();
  const normalized = [];

  for (const item of raw) {
    const key = String(item.text).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    normalized.push({
      text: item.text,
      templateSubtitleId: item.templateSubtitleId ?? null,
      files: Array.isArray(item.files) ? item.files : [],
      notes: Array.isArray(item.notes) ? item.notes : [],
    });
  }

  return { subtitles: normalized };
};

/**
 * normalize files input (single or multiple)
 */
const normalizeFilesInput = (body) => {
  const toFile = (f) => {
    const key = String(f?.key ?? "").trim();
    const url = String(f?.url ?? "").trim();
    const originalName = String(f?.originalName ?? "").trim();

    if (!key || !originalName) return null;

    return {
      key,
      url,
      originalName,
      displayName: f?.displayName ? String(f.displayName).trim() : "",
      mimeType: f?.mimeType ? String(f.mimeType).trim() : "",
      size: typeof f?.size === "number" ? f.size : 0,
    };
  };

  if (Array.isArray(body?.files)) {
    const list = body.files.map(toFile).filter(Boolean);
    if (list.length === 0) return { error: "files array is empty or invalid. key + originalName required." };
    return { files: list };
  }

  const single = toFile(body);
  if (!single) return { error: "Invalid file. key + originalName required." };
  return { files: [single] };
};

/**
 * build subtitle note (optional fileId)
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
 * ✅ NEW: Resolve subtitle inside a specific task safely
 * Accepts either:
 * - task subtitle _id
 * - OR templateSubtitleId (shared across tasks) but matched ONLY within that task
 */
const resolveTaskSubtitle = (task, subtitleIdOrTemplateId) => {
  const sidStr = String(subtitleIdOrTemplateId || "");
  if (!sidStr) return { error: "subtitleId is required." };

  const subs = Array.isArray(task?.subtitles) ? task.subtitles : [];

  // 1) match real task subtitle id
  let found = subs.find((s) => String(s?._id) === sidStr);
  if (found) return { subtitle: found, realSubtitleId: found._id };

  // 2) match templateSubtitleId
  found = subs.find((s) => s?.templateSubtitleId && String(s.templateSubtitleId) === sidStr);
  if (found) return { subtitle: found, realSubtitleId: found._id };

  return { error: "Subtitle not found in this task." };
};

/**
 * ✅ Template build: returns task subtitles with files+notes empty
 * ✅ FIX: store templateSubtitleId for safe mapping, but each task subtitle keeps its own unique _id
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
          tplSubtitleId: String(s?._id ?? ""),
          text: String(s?.text ?? "").trim(),
        }))
        .filter((s) => s.text && s.tplSubtitleId)
    : [];

  if (Array.isArray(selectedSubtitleIds) && selectedSubtitleIds.length > 0) {
    const allowed = new Set(selectedSubtitleIds.map(String));
    subtitles = subtitles.filter((s) => allowed.has(String(s.tplSubtitleId)));
  }

  const subtitleDocs = subtitles.map((s) => ({
    text: s.text,
    templateSubtitleId: toObjectIdSafe(s.tplSubtitleId) || null, // ✅ critical fix
    files: [],
    notes: [],
  }));

  return { title, subtitles: subtitleDocs, templateId: tpl._id };
};

/* ------------------ reporting helpers ------------------ */

const safeDate = (d) => {
  const x = d ? new Date(d) : null;
  return x && !isNaN(x.getTime()) ? x : null;
};

const diffMinutes = (a, b) => {
  if (!a || !b) return 0;
  const ms = new Date(b).getTime() - new Date(a).getTime();
  if (!Number.isFinite(ms) || ms <= 0) return 0;
  return Math.round(ms / 60000);
};

const writeServiceLogIfDone = async ({ customerId, task }) => {
  if (!task) return;
  if (String(task.status) !== "done") return;

  const now = new Date();
  const startedAt = safeDate(task.startedAt) || safeDate(task.createdAt) || now;
  const completedAt = safeDate(task.completedAt) || now;
  const durationMinutes = diffMinutes(startedAt, completedAt);

  try {
    await ServiceLog.create({
      customerId,
      taskId: task._id,
      serviceId: task.templateId || null,
      serviceTitleSnapshot: String(task.title || "").trim(),
      jobId: task.jobId || null,
      rootJobId: task.rootJobId || null,
      status: "done",
      startedAt,
      completedAt,
      durationMinutes,
      assignedTo: task.assignedTo || [],
      createdBy: task.createdBy || null,
    });
  } catch (e) {
    if (e?.code !== 11000) throw e; // ignore duplicate
  }
};

/* =========================================================
   TASKS LIST
   ✅ supports jobId=none to fetch direct tasks
========================================================= */
export const getCustomerTasks = async (req, res) => {
  try {
    const customerId = toObjectIdSafe(req.params.customerId);
    if (!customerId) return res.status(400).json({ message: "Invalid customerId." });

    const limit = clampInt(req.query.limit, 1, MAX_LIMIT, DEFAULT_LIMIT);
    const cursor = toObjectIdSafe(req.query.cursor);

    // ✅ jobId filter
    let jobId = null;
    let jobNone = false;
    if (req.query.jobId !== undefined) {
      const raw = String(req.query.jobId || "").trim();
      if (raw.toLowerCase() === "none") jobNone = true;
      else {
        jobId = toObjectIdSafe(raw);
        if (!jobId) return res.status(400).json({ message: "Invalid jobId filter." });
      }
    }

    const rootJobId = req.query.rootJobId ? toObjectIdSafe(req.query.rootJobId) : null;
    if (req.query.rootJobId && !rootJobId) return res.status(400).json({ message: "Invalid rootJobId filter." });

    const isAdmin = isAdminOrSuperAdmin(req);
    const uid = toObjectIdSafe(req.user?._id);

    const customer = await Customer.findById(customerId).select("_id createdBy assignedTo").lean();
    if (!customer) return res.status(404).json({ message: "Customer not found." });

    if (!isAdmin) {
      if (!customerAccessForEmployee(customer, req.user._id)) {
        return res.status(403).json({ message: "No access to this customer." });
      }
    }

    const matchTask = {};
    if (cursor) matchTask["crmTasks._id"] = { $lt: cursor };
    if (!isAdmin && uid) matchTask["crmTasks.assignedTo"] = uid;
    if (jobId) matchTask["crmTasks.jobId"] = jobId;
    if (jobNone) matchTask["crmTasks.jobId"] = null;
    if (rootJobId) matchTask["crmTasks.rootJobId"] = rootJobId;

    const pipeline = [
      { $match: { _id: customerId } },
      { $unwind: "$crmTasks" },
      ...(Object.keys(matchTask).length ? [{ $match: matchTask }] : []),
      { $sort: { "crmTasks._id": -1 } },
      { $limit: limit + 1 },
      { $replaceRoot: { newRoot: "$crmTasks" } },
      {
        $project: {
          _id: 1,
          title: 1,
          jobId: 1,
          rootJobId: 1,
          subtitles: 1,
          templateId: 1,
          description: 1,
          status: 1,
          startedAt: 1,
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
   CREATE TASK (Admin only)
   ✅ jobId optional now (direct task)
========================================================= */
export const addTask = async (req, res) => {
  try {
    if (!isAdminOrSuperAdmin(req)) {
      return res.status(403).json({ message: "Only admin/superadmin can create tasks." });
    }

    const customerId = toObjectIdSafe(req.params.customerId);
    if (!customerId) return res.status(400).json({ message: "Invalid customerId." });

    const { description, dueAt, status, templateId, selectedSubtitleIds } = req.body;

    const jobIdRaw = req.body?.jobId;
    const jobId = jobIdRaw ? toObjectIdSafe(jobIdRaw) : null;
    if (jobIdRaw && !jobId) return res.status(400).json({ message: "jobId must be valid if provided." });

    const finalStatus = status ? String(status) : "pending";
    if (!ALLOWED_STATUSES.includes(finalStatus)) {
      return res.status(400).json({ message: "Invalid status value." });
    }

    const { ids, error } = normalizeEmployeeIds(req.body);
    if (error) return res.status(400).json({ message: error });

    const okEmployees = await ensureEmployeesExistFast(ids);
    if (!okEmployees) return res.status(404).json({ message: "One or more employees not found or inactive." });

    const customer = await Customer.findById(customerId).select("_id assignedTo jobs").lean();
    if (!customer) return res.status(404).json({ message: "Customer not found." });

    const check = ensureAssigneesAssignedToCustomerFast(customer.assignedTo, ids);
    if (!check.ok) {
      return res.status(400).json({
        message: "All task assignees must be assigned to this customer first.",
        notAssigned: check.notAssigned,
      });
    }

    const { rootJobId, error: jobErr } = resolveRootJobId(customer.jobs || [], jobId);
    if (jobErr) return res.status(400).json({ message: jobErr });

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
    const startedAt = finalStatus === "in_progress" || finalStatus === "done" ? now : null;

    const taskDoc = {
      _id: taskId,
      title: taskTitle,

      // ✅ allow direct tasks
      jobId: jobId || null,
      rootJobId: rootJobId || null,

      subtitles: taskSubtitles,
      templateId: usedTemplateId,
      description: description ? String(description).trim() : "",
      status: finalStatus,
      startedAt,
      dueAt: dueAt ? new Date(dueAt) : null,
      completedAt: finalStatus === "done" ? now : null,
      createdBy: req.user._id,
      assignedTo: ids,
      reminders: [],
      createdAt: now,
      updatedAt: now,
    };

    await Customer.updateOne({ _id: customerId }, { $push: { crmTasks: taskDoc } });

    if (finalStatus === "done") {
      await writeServiceLogIfDone({ customerId, task: taskDoc });
    }

    return res.status(201).json({ message: "Task created.", task: taskDoc });
  } catch (err) {
    return res.status(500).json({ message: "Server error in addTask.", error: err.message });
  }
};

/* =========================================================
   ADMIN UPDATE TASK
   ✅ allow moving:
     - set jobId to valid job => under job/subjob
     - set jobId to null => direct task
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
      templateId,
      selectedSubtitleIds,
      jobId: nextJobIdRaw,
    } = req.body;

    if (status !== undefined && !ALLOWED_STATUSES.includes(String(status))) {
      return res.status(400).json({ message: "Invalid status value." });
    }

    const found = await Customer.findOne(
      { _id: customerId, "crmTasks._id": taskId },
      { assignedTo: 1, jobs: 1, "crmTasks.$": 1 }
    ).lean();

    if (!found) return res.status(404).json({ message: "Customer or task not found." });

    const existingTask = found.crmTasks?.[0];
    if (!existingTask) return res.status(404).json({ message: "Task not found." });

    const $set = {};
    const now = new Date();

    if (description !== undefined) $set["crmTasks.$.description"] = String(description || "").trim();
    if (dueAt !== undefined) $set["crmTasks.$.dueAt"] = dueAt ? new Date(dueAt) : null;

    // ✅ job move (allow null)
    if (nextJobIdRaw !== undefined) {
      if (nextJobIdRaw === null || nextJobIdRaw === "" || String(nextJobIdRaw).toLowerCase() === "none") {
        $set["crmTasks.$.jobId"] = null;
        $set["crmTasks.$.rootJobId"] = null;
      } else {
        const nextJobId = toObjectIdSafe(nextJobIdRaw);
        if (!nextJobId) return res.status(400).json({ message: "jobId must be valid or null." });

        const { rootJobId, error: jobErr } = resolveRootJobId(found.jobs || [], nextJobId);
        if (jobErr) return res.status(400).json({ message: jobErr });

        $set["crmTasks.$.jobId"] = nextJobId;
        $set["crmTasks.$.rootJobId"] = rootJobId;
      }
    }

    // template change
    if (templateId !== undefined) {
      if (templateId) {
        const built = await buildTaskFromTemplate(templateId, selectedSubtitleIds);
        if (built.error) return res.status(404).json({ message: built.error });

        $set["crmTasks.$.title"] = built.title;
        $set["crmTasks.$.subtitles"] = built.subtitles;
        $set["crmTasks.$.templateId"] = built.templateId;
      } else {
        $set["crmTasks.$.templateId"] = null;

        if (title !== undefined) {
          const t = String(title ?? "").trim();
          if (!t) return res.status(400).json({ message: "title cannot be empty." });
          $set["crmTasks.$.title"] = t;
        }

        if (subtitles !== undefined) {
          const { subtitles: norm, error: subErr } = normalizeManualSubtitlesV2(subtitles, existingTask.subtitles);
          if (subErr) return res.status(400).json({ message: subErr });
          $set["crmTasks.$.subtitles"] = norm;
        }
      }
    } else {
      if (!existingTask.templateId) {
        if (title !== undefined) {
          const t = String(title ?? "").trim();
          if (!t) return res.status(400).json({ message: "title cannot be empty." });
          $set["crmTasks.$.title"] = t;
        }

        if (subtitles !== undefined) {
          const { subtitles: norm, error: subErr } = normalizeManualSubtitlesV2(subtitles, existingTask.subtitles);
          if (subErr) return res.status(400).json({ message: subErr });
          $set["crmTasks.$.subtitles"] = norm;
        }
      }
    }

    // status rules
    if (status !== undefined) {
      const s = String(status);
      $set["crmTasks.$.status"] = s;

      if (s === "in_progress") {
        if (!existingTask.startedAt) $set["crmTasks.$.startedAt"] = now;
        $set["crmTasks.$.completedAt"] = null;
      } else if (s === "done") {
        const started = safeDate(existingTask.startedAt) || now;
        $set["crmTasks.$.startedAt"] = started;
        $set["crmTasks.$.completedAt"] = now;
      } else {
        $set["crmTasks.$.completedAt"] = null;
      }
    }

    if (Object.keys($set).length === 0) {
      return res.status(200).json({ message: "No changes.", task: existingTask });
    }

    $set["crmTasks.$.updatedAt"] = now;

    await Customer.updateOne({ _id: customerId, "crmTasks._id": taskId }, { $set });

    const updated = await Customer.findOne({ _id: customerId, "crmTasks._id": taskId }, { "crmTasks.$": 1 }).lean();
    const updatedTask = updated?.crmTasks?.[0] ?? null;

    if (updatedTask && String(updatedTask.status) === "done") {
      await writeServiceLogIfDone({ customerId, task: updatedTask });
    }

    return res.status(200).json({ message: "Task updated.", task: updatedTask });
  } catch (err) {
    return res.status(500).json({ message: "Server error in updateTaskByAdmin.", error: err.message });
  }
};

/* =========================================================
   EMPLOYEE STATUS UPDATE (unchanged logic)
========================================================= */
export const updateTaskStatus = async (req, res) => {
  try {
    const customerId = toObjectIdSafe(req.params.customerId);
    const taskId = toObjectIdSafe(req.params.taskId);
    if (!customerId || !taskId) return res.status(400).json({ message: "Invalid ids." });

    const nextStatus = String(req.body?.status ?? "");
    if (!ALLOWED_STATUSES.includes(nextStatus)) {
      return res.status(400).json({ message: "Invalid status value." });
    }

    const found = await Customer.findOne(
      { _id: customerId, "crmTasks._id": taskId },
      { createdBy: 1, assignedTo: 1, "crmTasks.$": 1 }
    ).lean();

    if (!found) return res.status(404).json({ message: "Customer or task not found." });

    if (!isAdminOrSuperAdmin(req)) {
      if (!customerAccessForEmployee(found, req.user._id)) {
        return res.status(403).json({ message: "No access to this customer." });
      }
    }

    const task = found.crmTasks?.[0];
    if (!task) return res.status(404).json({ message: "Task not found." });

    if (!isAdminOrSuperAdmin(req) && req.user.role === "employee") {
      if (!isTaskAssignedToUser(task, req.user._id)) {
        return res.status(403).json({ message: "You are not assigned to this task." });
      }
    }

    const now = new Date();
    const $set = {
      "crmTasks.$.status": nextStatus,
      "crmTasks.$.updatedAt": now,
    };

    if (nextStatus === "in_progress") {
      if (!task.startedAt) $set["crmTasks.$.startedAt"] = now;
      $set["crmTasks.$.completedAt"] = null;
    } else if (nextStatus === "done") {
      const started = safeDate(task.startedAt) || now;
      $set["crmTasks.$.startedAt"] = started;
      $set["crmTasks.$.completedAt"] = now;
    } else {
      $set["crmTasks.$.completedAt"] = null;
    }

    await Customer.updateOne({ _id: customerId, "crmTasks._id": taskId }, { $set });

    const updated = await Customer.findOne(
      { _id: customerId, "crmTasks._id": taskId },
      { "crmTasks.$": 1 }
    ).lean();

    const updatedTask = updated?.crmTasks?.[0] ?? null;

    if (updatedTask && String(updatedTask.status) === "done") {
      await writeServiceLogIfDone({ customerId, task: updatedTask });
    }

    return res.status(200).json({ message: "Task status updated.", task: updatedTask });
  } catch (err) {
    return res.status(500).json({ message: "Server error in updateTaskStatus.", error: err.message });
  }
};

/* =========================================================
   SUBTITLE FILES - CREATE
   ✅ FIXED: subtitleId param can be task subtitle _id OR templateSubtitleId
========================================================= */
export const addSubtitleFiles = async (req, res) => {
  try {
    const customerId = toObjectIdSafe(req.params.customerId);
    const taskId = toObjectIdSafe(req.params.taskId);
    const subtitleIdParam = req.params.subtitleId; // could be task subtitle _id OR templateSubtitleId

    if (!customerId || !taskId || !subtitleIdParam) {
      return res.status(400).json({ message: "Invalid ids." });
    }

    const found = await Customer.findOne(
      { _id: customerId, "crmTasks._id": taskId },
      { createdBy: 1, assignedTo: 1, "crmTasks.$": 1 }
    ).lean();

    if (!found) return res.status(404).json({ message: "Customer or task not found." });

    if (!isAdminOrSuperAdmin(req)) {
      if (!customerAccessForEmployee(found, req.user._id)) {
        return res.status(403).json({ message: "No access to this customer." });
      }
    }

    const task = found.crmTasks?.[0];
    if (!task) return res.status(404).json({ message: "Task not found." });

    if (!isAdminOrSuperAdmin(req) && req.user.role === "employee") {
      if (!isTaskAssignedToUser(task, req.user._id)) {
        return res.status(403).json({ message: "You are not assigned to this task." });
      }
    }

    // ✅ resolve correct subtitle INSIDE this task
    const { realSubtitleId, error: subErr } = resolveTaskSubtitle(task, subtitleIdParam);
    if (subErr) return res.status(404).json({ message: subErr });

    const { files, error } = normalizeFilesInput(req.body);
    if (error) return res.status(400).json({ message: error });

    const readyFiles = files.map((f) => ({
      _id: new Types.ObjectId(),
      ...f,
      uploadedBy: req.user?._id ?? null,
      uploadedAt: new Date(),
    }));

    const noteText = String(req.body?.note ?? "").trim();
    const attachNoteTo = String(req.body?.attachNoteTo ?? "subtitle"); // subtitle | file

    let notesToPush = [];
    if (noteText) {
      if (attachNoteTo === "file") {
        notesToPush = readyFiles.map((rf) => buildSubtitleNote(req, noteText, rf._id));
      } else {
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

    await Customer.updateOne({ _id: customerId }, update, {
      arrayFilters: [{ "t._id": taskId }, { "s._id": realSubtitleId }],
    });

    return res.status(201).json({
      message: "Files added under subtitle.",
      files: readyFiles,
      notesAdded: notesToPush.length,
      subtitleIdUsed: String(realSubtitleId),
    });
  } catch (err) {
    return res.status(500).json({ message: "Server error in addSubtitleFiles.", error: err.message });
  }
};

/* =========================================================
   SUBTITLE FILES - READ
   ✅ FIXED: subtitleId param can be task subtitle _id OR templateSubtitleId
========================================================= */
export const getSubtitleFiles = async (req, res) => {
  try {
    const customerId = toObjectIdSafe(req.params.customerId);
    const taskId = toObjectIdSafe(req.params.taskId);
    const subtitleIdParam = req.params.subtitleId;

    if (!customerId || !taskId || !subtitleIdParam) {
      return res.status(400).json({ message: "Invalid ids." });
    }

    const found = await Customer.findOne(
      { _id: customerId, "crmTasks._id": taskId },
      { createdBy: 1, assignedTo: 1, "crmTasks.$": 1 }
    ).lean();

    if (!found) return res.status(404).json({ message: "Customer or task not found." });

    if (!isAdminOrSuperAdmin(req)) {
      if (!customerAccessForEmployee(found, req.user._id)) {
        return res.status(403).json({ message: "No access to this customer." });
      }
    }

    const task = found.crmTasks?.[0];
    if (!task) return res.status(404).json({ message: "Task not found." });

    if (!isAdminOrSuperAdmin(req) && req.user.role === "employee") {
      if (!isTaskAssignedToUser(task, req.user._id)) {
        return res.status(403).json({ message: "You are not assigned to this task." });
      }
    }

    const { subtitle, error: subErr } = resolveTaskSubtitle(task, subtitleIdParam);
    if (subErr) return res.status(404).json({ message: subErr });

    return res.status(200).json({
      message: "Subtitle files fetched.",
      files: subtitle.files || [],
      count: (subtitle.files || []).length,
      subtitleIdUsed: String(subtitle._id),
    });
  } catch (err) {
    return res.status(500).json({ message: "Server error in getSubtitleFiles.", error: err.message });
  }
};

/* =========================================================
   SUBTITLE FILES - UPDATE
   ✅ FIXED: subtitleId param can be task subtitle _id OR templateSubtitleId
========================================================= */
export const updateSubtitleFile = async (req, res) => {
  try {
    const customerId = toObjectIdSafe(req.params.customerId);
    const taskId = toObjectIdSafe(req.params.taskId);
    const subtitleIdParam = req.params.subtitleId;
    const fileId = toObjectIdSafe(req.params.fileId);

    if (!customerId || !taskId || !subtitleIdParam || !fileId) {
      return res.status(400).json({ message: "Invalid ids." });
    }

    const found = await Customer.findOne(
      { _id: customerId, "crmTasks._id": taskId },
      { createdBy: 1, assignedTo: 1, "crmTasks.$": 1 }
    ).lean();

    if (!found) return res.status(404).json({ message: "Customer or task not found." });

    if (!isAdminOrSuperAdmin(req)) {
      if (!customerAccessForEmployee(found, req.user._id)) {
        return res.status(403).json({ message: "No access to this customer." });
      }
    }

    const task = found.crmTasks?.[0];
    if (!task) return res.status(404).json({ message: "Task not found." });

    if (!isAdminOrSuperAdmin(req) && req.user.role === "employee") {
      if (!isTaskAssignedToUser(task, req.user._id)) {
        return res.status(403).json({ message: "You are not assigned to this task." });
      }
    }

    const { subtitle, realSubtitleId, error: subErr } = resolveTaskSubtitle(task, subtitleIdParam);
    if (subErr) return res.status(404).json({ message: subErr });

    const existing = (subtitle.files || []).find((f) => String(f?._id) === String(fileId));
    if (!existing) return res.status(404).json({ message: "File not found in this subtitle." });

    const displayName =
      req.body?.displayName !== undefined ? String(req.body.displayName || "").trim() : undefined;

    const $set = {};
    if (displayName !== undefined) {
      $set["crmTasks.$[t].subtitles.$[s].files.$[f].displayName"] = displayName;
    }

    if (!Object.keys($set).length) {
      return res.status(400).json({ message: "No valid fields to update. Allowed: displayName" });
    }

    await Customer.updateOne(
      { _id: customerId },
      { $set },
      { arrayFilters: [{ "t._id": taskId }, { "s._id": realSubtitleId }, { "f._id": fileId }] }
    );

    const refreshed = await Customer.findOne(
      { _id: customerId, "crmTasks._id": taskId },
      { "crmTasks.$": 1 }
    ).lean();

    const task2 = refreshed?.crmTasks?.[0];
    const { subtitle: subtitle2 } = resolveTaskSubtitle(task2, realSubtitleId);
    const file2 = (subtitle2?.files || []).find((f) => String(f?._id) === String(fileId));

    return res.status(200).json({ message: "File updated.", file: file2, subtitleIdUsed: String(realSubtitleId) });
  } catch (err) {
    return res.status(500).json({ message: "Server error in updateSubtitleFile.", error: err.message });
  }
};

/* =========================================================
   SUBTITLE FILES - DELETE
   ✅ FIXED: subtitleId param can be task subtitle _id OR templateSubtitleId
========================================================= */
export const deleteSubtitleFile = async (req, res) => {
  try {
    const customerId = toObjectIdSafe(req.params.customerId);
    const taskId = toObjectIdSafe(req.params.taskId);
    const subtitleIdParam = req.params.subtitleId;
    const fileId = toObjectIdSafe(req.params.fileId);

    if (!customerId || !taskId || !subtitleIdParam || !fileId) {
      return res.status(400).json({ message: "Invalid ids." });
    }

    const found = await Customer.findOne(
      { _id: customerId, "crmTasks._id": taskId },
      { createdBy: 1, assignedTo: 1, "crmTasks.$": 1 }
    ).lean();

    if (!found) return res.status(404).json({ message: "Customer or task not found." });

    if (!isAdminOrSuperAdmin(req)) {
      if (!customerAccessForEmployee(found, req.user._id)) {
        return res.status(403).json({ message: "No access to this customer." });
      }
    }

    const task = found.crmTasks?.[0];
    if (!task) return res.status(404).json({ message: "Task not found." });

    if (!isAdminOrSuperAdmin(req) && req.user.role === "employee") {
      if (!isTaskAssignedToUser(task, req.user._id)) {
        return res.status(403).json({ message: "You are not assigned to this task." });
      }
    }

    const { subtitle, realSubtitleId, error: subErr } = resolveTaskSubtitle(task, subtitleIdParam);
    if (subErr) return res.status(404).json({ message: subErr });

    const file = (subtitle.files || []).find((f) => String(f?._id) === String(fileId));
    if (!file) return res.status(404).json({ message: "File not found in this subtitle." });

    // 1) remove from DB + remove notes referencing that fileId
    await Customer.updateOne(
      { _id: customerId },
      {
        $pull: {
          "crmTasks.$[t].subtitles.$[s].files": { _id: fileId },
          "crmTasks.$[t].subtitles.$[s].notes": { fileId: fileId },
        },
      },
      { arrayFilters: [{ "t._id": taskId }, { "s._id": realSubtitleId }] }
    );

    // 2) OPTIONAL: delete from S3
    try {
      if (file?.key) {
        await s3.send(
          new DeleteObjectCommand({
            Bucket: process.env.AWS_S3_BUCKET,
            Key: file.key,
          })
        );
      }
    } catch (e) {
      return res.status(200).json({
        message: "File deleted from DB. S3 delete failed (check logs).",
        deletedFileId: String(fileId),
        subtitleIdUsed: String(realSubtitleId),
        s3Error: e?.message || "Unknown S3 error",
      });
    }

    return res.status(200).json({
      message: "File deleted.",
      deletedFileId: String(fileId),
      subtitleIdUsed: String(realSubtitleId),
    });
  } catch (err) {
    return res.status(500).json({ message: "Server error in deleteSubtitleFile.", error: err.message });
  }
};

/* =========================================================
   ADD NOTE UNDER A SUBTITLE
   ✅ FIXED: subtitleId param can be task subtitle _id OR templateSubtitleId
========================================================= */
export const addSubtitleNote = async (req, res) => {
  try {
    const customerId = toObjectIdSafe(req.params.customerId);
    const taskId = toObjectIdSafe(req.params.taskId);
    const subtitleIdParam = req.params.subtitleId;

    if (!customerId || !taskId || !subtitleIdParam) {
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

    if (!isAdminOrSuperAdmin(req)) {
      if (!customerAccessForEmployee(found, req.user._id)) {
        return res.status(403).json({ message: "No access to this customer." });
      }
    }

    const task = found.crmTasks?.[0];
    if (!task) return res.status(404).json({ message: "Task not found." });

    if (!isAdminOrSuperAdmin(req) && req.user.role === "employee") {
      if (!isTaskAssignedToUser(task, req.user._id)) {
        return res.status(403).json({ message: "You are not assigned to this task." });
      }
    }

    const { subtitle, realSubtitleId, error: subErr } = resolveTaskSubtitle(task, subtitleIdParam);
    if (subErr) return res.status(404).json({ message: subErr });

    if (fileId) {
      const ok = (subtitle.files || []).some((f) => String(f?._id) === String(fileId));
      if (!ok) return res.status(404).json({ message: "fileId not found inside this subtitle." });
    }

    const noteObj = buildSubtitleNote(req, text, fileId);
    if (!noteObj) return res.status(400).json({ message: "Invalid note." });

    await Customer.updateOne(
      { _id: customerId },
      { $push: { "crmTasks.$[t].subtitles.$[s].notes": noteObj } },
      { arrayFilters: [{ "t._id": taskId }, { "s._id": realSubtitleId }] }
    );

    return res.status(201).json({
      message: "Note added under subtitle.",
      note: noteObj,
      subtitleIdUsed: String(realSubtitleId),
    });
  } catch (err) {
    return res.status(500).json({ message: "Server error in addSubtitleNote.", error: err.message });
  }
};

/* =========================================================
   DELETE TASK (admin/superadmin)
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
   OLD ROUTE (DEPRECATED)
========================================================= */
export const addTaskFile = async (req, res) => {
  return res.status(410).json({
    message: "This endpoint is deprecated. Upload files under subtitle instead.",
    newEndpoint: "POST /customers/:customerId/tasks/:taskId/subtitles/:subtitleId/files",
  });
};

/* =========================================================
   DEADLINE NOTIFICATIONS (unchanged)
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
  const { now, includeOverdue, limit, windowEnd } = parseDeadlineQuery(req);
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
        jobId: "$crmTasks.jobId",
        rootJobId: "$crmTasks.rootJobId",
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

  return { now, count: items.length, items };
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
