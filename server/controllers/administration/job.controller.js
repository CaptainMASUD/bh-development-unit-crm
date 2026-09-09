// controllers/job.controller.js
import mongoose from "mongoose";
import Customer from "../../models/customer.model.js";
import User from "../../models/user.model.js";
import { dashboardCache } from "../../utils/cache.js";

const { Types } = mongoose;

const isAdminOrSuperAdmin = (req) => {
  const role = req?.user?.role ?? req?.role;
  return role === "admin" || role === "superadmin";
};

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

const toObjectIdSafe = (id) => {
  try {
    if (!id) return null;
    if (Types.ObjectId.isValid(id)) return new Types.ObjectId(String(id));
    return null;
  } catch {
    return null;
  }
};

const toIdString = (x) => {
  if (!x) return "";
  if (typeof x === "object") return String(x._id ?? x.id ?? "");
  return String(x);
};

const normalizeEmployeeIdsOptional = (body) => {
  const { employeeId, employeeIds, assignedTo } = body;

  let ids = [];
  const hasAny =
    assignedTo !== undefined || employeeIds !== undefined || employeeId !== undefined;

  if (!hasAny) return { ids: [], hasAny: false };

  if (assignedTo !== undefined) {
    if (!Array.isArray(assignedTo)) return { error: "assignedTo must be an array.", hasAny: true };
    ids = assignedTo.map(toIdString).filter(Boolean);
  } else if (employeeIds !== undefined) {
    if (!Array.isArray(employeeIds)) return { error: "employeeIds must be an array.", hasAny: true };
    ids = employeeIds.map(toIdString).filter(Boolean);
  } else if (employeeId !== undefined) {
    ids = [toIdString(employeeId)].filter(Boolean);
  }

  ids = Array.from(new Set(ids));
  const objIds = ids.map(toObjectIdSafe).filter(Boolean);
  if (objIds.length !== ids.length) return { error: "One or more assignee IDs are invalid.", hasAny: true };

  return { ids: objIds, hasAny: true };
};

const ensureEmployeesExistFast = async (ids) => {
  if (!ids.length) return true;
  const count = await User.countDocuments({
    _id: { $in: ids },
    role: "employee",
    isActive: true,
  });
  return count === ids.length;
};

const customerAccessForEmployee = (customer, userId) => {
  if (!customer) return false;
  const uid = String(userId);

  const createdBy = String(customer.createdBy?._id ?? customer.createdBy ?? "");
  const assigned = Array.isArray(customer.assignedTo) ? customer.assignedTo : [];
  const assignedIds = assigned.map((x) => String(x?._id ?? x));

  return createdBy === uid || assignedIds.includes(uid);
};

const buildJobsTree = (jobs) => {
  const list = Array.isArray(jobs) ? jobs : [];
  const children = new Map();
  const top = [];

  for (const j of list) {
    const pid = j.parentJobId ? String(j.parentJobId) : null;
    if (!pid) top.push(j);
    else {
      if (!children.has(pid)) children.set(pid, []);
      children.get(pid).push(j);
    }
  }

  // stable sort by createdAt then _id
  const sortFn = (a, b) => {
    const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    if (ta !== tb) return ta - tb;
    return String(a._id).localeCompare(String(b._id));
  };

  top.sort(sortFn);
  for (const [, arr] of children) arr.sort(sortFn);

  return top.map((j) => ({
    ...j,
    children: (children.get(String(j._id)) || []).map((c) => ({ ...c, children: [] })),
  }));
};

/**
 * POST /customers/:customerId/jobs
 * body: { title, parentJobId?, code?, startAt?, endAt?, status?, assignedTo/employeeIds/employeeId? }
 * Admin only
 * Depth limit: Customer -> Job -> SubJob (parent must be root)
 */
export const createJob = async (req, res) => {
  try {
    if (!isAdminOrSuperAdmin(req)) {
      return res.status(403).json({ message: "Only admin/superadmin can create jobs." });
    }

    const customerId = toObjectIdSafe(req.params.customerId);
    if (!customerId) return res.status(400).json({ message: "Invalid customerId." });

    const title = String(req.body?.title ?? "").trim();
    if (!title) return res.status(400).json({ message: "title is required." });

    const parentJobId = req.body?.parentJobId ? toObjectIdSafe(req.body.parentJobId) : null;
    if (req.body?.parentJobId && !parentJobId) return res.status(400).json({ message: "Invalid parentJobId." });

    const customer = await Customer.findById(customerId).select("_id jobs").lean();
    if (!customer) return res.status(404).json({ message: "Customer not found." });

    // depth validation
    let rootParent = null;
    if (parentJobId) {
      const parent = (customer.jobs || []).find((j) => String(j._id) === String(parentJobId));
      if (!parent) return res.status(404).json({ message: "parentJobId not found under this customer." });
      if (parent.parentJobId) {
        return res.status(400).json({
          message: "Depth limit reached. Cannot create a sub-job under a sub-job (max depth=2).",
        });
      }
      rootParent = parent._id;
    }

    // optional assignees
    const { ids, error, hasAny } = normalizeEmployeeIdsOptional(req.body);
    if (error) return res.status(400).json({ message: error });

    if (hasAny) {
      const ok = await ensureEmployeesExistFast(ids);
      if (!ok) return res.status(404).json({ message: "One or more employees not found or inactive." });
    }

    const now = new Date();
    const jobDoc = {
      _id: new Types.ObjectId(),
      title,
      parentJobId: rootParent ? rootParent : null,

      status: ["active", "on_hold", "completed"].includes(String(req.body?.status ?? ""))
        ? String(req.body.status)
        : "active",

      code: String(req.body?.code ?? "").trim(),
      startAt: req.body?.startAt ? new Date(req.body.startAt) : null,
      endAt: req.body?.endAt ? new Date(req.body.endAt) : null,

      createdBy: req.user._id,
      assignedTo: ids || [],

      createdAt: now,
      updatedAt: now,
    };

    await Customer.updateOne({ _id: customerId }, { $push: { jobs: jobDoc } });

    invalidateDashboardCache();

    return res.status(201).json({ message: "Job created.", job: jobDoc });
  } catch (err) {
    return res.status(500).json({ message: "Server error in createJob.", error: err.message });
  }
};

/**
 * GET /customers/:customerId/jobs
 * Admin: all
 * Employee: must have customer access
 */
export const listJobs = async (req, res) => {
  try {
    const customerId = toObjectIdSafe(req.params.customerId);
    if (!customerId) return res.status(400).json({ message: "Invalid customerId." });

    const customer = await Customer.findById(customerId).select("_id createdBy assignedTo jobs").lean();
    if (!customer) return res.status(404).json({ message: "Customer not found." });

    if (!isAdminOrSuperAdmin(req)) {
      if (!customerAccessForEmployee(customer, req.user._id)) {
        return res.status(403).json({ message: "No access to this customer." });
      }
    }

    const jobsTree = buildJobsTree(customer.jobs || []);
    return res.status(200).json({ message: "Jobs fetched.", jobs: jobsTree, count: jobsTree.length });
  } catch (err) {
    return res.status(500).json({ message: "Server error in listJobs.", error: err.message });
  }
};

/**
 * PATCH /customers/:customerId/jobs/:jobId
 * Admin only
 * body: { title?, status?, code?, startAt?, endAt?, assignedTo? }
 */
export const updateJob = async (req, res) => {
  try {
    if (!isAdminOrSuperAdmin(req)) {
      return res.status(403).json({ message: "Only admin/superadmin can update jobs." });
    }

    const customerId = toObjectIdSafe(req.params.customerId);
    const jobId = toObjectIdSafe(req.params.jobId);
    if (!customerId || !jobId) return res.status(400).json({ message: "Invalid ids." });

    const found = await Customer.findOne({ _id: customerId, "jobs._id": jobId }, { "jobs.$": 1 }).lean();
    if (!found) return res.status(404).json({ message: "Customer or job not found." });

    const $set = {};
    if (req.body.title !== undefined) {
      const t = String(req.body.title ?? "").trim();
      if (!t) return res.status(400).json({ message: "title cannot be empty." });
      $set["jobs.$.title"] = t;
    }

    if (req.body.status !== undefined) {
      const s = String(req.body.status ?? "");
      if (!["active", "on_hold", "completed"].includes(s)) {
        return res.status(400).json({ message: "Invalid status. Allowed: active, on_hold, completed." });
      }
      $set["jobs.$.status"] = s;
    }

    if (req.body.code !== undefined) $set["jobs.$.code"] = String(req.body.code ?? "").trim();
    if (req.body.startAt !== undefined) $set["jobs.$.startAt"] = req.body.startAt ? new Date(req.body.startAt) : null;
    if (req.body.endAt !== undefined) $set["jobs.$.endAt"] = req.body.endAt ? new Date(req.body.endAt) : null;

    // optional assignees
    const { ids, error, hasAny } = normalizeEmployeeIdsOptional(req.body);
    if (error) return res.status(400).json({ message: error });
    if (hasAny) {
      const ok = await ensureEmployeesExistFast(ids);
      if (!ok) return res.status(404).json({ message: "One or more employees not found or inactive." });
      $set["jobs.$.assignedTo"] = ids;
    }

    $set["jobs.$.updatedAt"] = new Date();

    if (!Object.keys($set).length) return res.status(200).json({ message: "No changes." });

    await Customer.updateOne({ _id: customerId, "jobs._id": jobId }, { $set });

    invalidateDashboardCache();

    const updated = await Customer.findOne({ _id: customerId, "jobs._id": jobId }, { "jobs.$": 1 }).lean();
    return res.status(200).json({ message: "Job updated.", job: updated?.jobs?.[0] ?? null });
  } catch (err) {
    return res.status(500).json({ message: "Server error in updateJob.", error: err.message });
  }
};

/**
 * DELETE /customers/:customerId/jobs/:jobId
 * Admin only
 * Safety rules:
 *  - cannot delete if it has children
 *  - cannot delete if tasks exist under that jobId
 */
export const deleteJob = async (req, res) => {
  try {
    if (!isAdminOrSuperAdmin(req)) {
      return res.status(403).json({ message: "Only admin/superadmin can delete jobs." });
    }

    const customerId = toObjectIdSafe(req.params.customerId);
    const jobId = toObjectIdSafe(req.params.jobId);
    if (!customerId || !jobId) return res.status(400).json({ message: "Invalid ids." });

    const customer = await Customer.findById(customerId).select("_id jobs crmTasks").lean();
    if (!customer) return res.status(404).json({ message: "Customer not found." });

    const jobs = customer.jobs || [];
    const node = jobs.find((j) => String(j._id) === String(jobId));
    if (!node) return res.status(404).json({ message: "Job not found." });

    // has children?
    const hasChild = jobs.some((j) => j.parentJobId && String(j.parentJobId) === String(jobId));
    if (hasChild) {
      return res.status(400).json({ message: "Cannot delete job: it has sub-jobs. Delete sub-jobs first." });
    }

    // has tasks?
    const hasTasks = (customer.crmTasks || []).some((t) => String(t.jobId) === String(jobId));
    if (hasTasks) {
      return res.status(400).json({ message: "Cannot delete job: tasks exist under this job. Move/delete tasks first." });
    }

    await Customer.updateOne({ _id: customerId }, { $pull: { jobs: { _id: jobId } } });

    invalidateDashboardCache();

    return res.status(200).json({ message: "Job deleted." });
  } catch (err) {
    return res.status(500).json({ message: "Server error in deleteJob.", error: err.message });
  }
};
