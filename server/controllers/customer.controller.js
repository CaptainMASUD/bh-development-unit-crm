// controllers/customer.controller.js
import mongoose from "mongoose";
import Customer from "../models/customer.model.js";
import User from "../models/user.model.js";
import EngagementTemplate from "../models/engagementTemplate.model.js";

// ✅ NEW CRM MODULES
import Deal from "../models/deal.model.js";
import Order from "../models/order.model.js";
import Invoice from "../models/invoice.model.js";
import Activity from "../models/activity.model.js";

// ✅ Dashboard cache invalidation (fix counts after create/delete/update)
import { dashboardCache } from "../utils/cache.js";

/* ------------------ helpers ------------------ */

const isAdminOrSuperAdmin = (userOrReq) => {
  const role = userOrReq?.user?.role ?? userOrReq?.role;
  return role === "admin" || role === "superadmin";
};

const invalidateDashboardCache = () => {
  try {
    const keys = dashboardCache.keys?.() || [];
    for (const k of keys) {
      if (String(k).startsWith("dashboard:v1:")) dashboardCache.del(k);
    }
  } catch {
    // fallback
    try {
      dashboardCache.flushAll?.();
    } catch {}
  }
};

const canAccessCustomerDoc = (customerDoc, req) => {
  if (!customerDoc) return false;
  if (isAdminOrSuperAdmin(req)) return true;

  const uid = String(req.user?._id || "");
  const createdBy = String(customerDoc.createdBy?._id ?? customerDoc.createdBy ?? "");
  const assigned = Array.isArray(customerDoc.assignedTo) ? customerDoc.assignedTo : [];
  const assignedIds = assigned.map((x) => String(x?._id ?? x));

  return createdBy === uid || assignedIds.includes(uid);
};

const normalizeContactPerson = (contactPerson) => {
  if (!contactPerson) return null;
  if (typeof contactPerson === "string") return { name: contactPerson };
  if (typeof contactPerson === "object") return contactPerson;
  return null;
};

const normalizeStatus = (status) => {
  if (!status) return "pending";
  const s = String(status).toLowerCase();
  if (s === "pending" || s === "in_progress" || s === "complete") return s;
  return "pending";
};

const normalizeCustomerType = (v) => {
  const s = String(v ?? "").trim().toLowerCase();
  if (!s) return "new";
  if (s === "new") return "new";
  if (s === "recurring" || s === "existing" || s === "repeat") return "recurring";
  return "new";
};

const normalizeLifecycleStage = (v) => {
  if (!v) return null;
  const s = String(v).trim().toLowerCase();
  const allowed = new Set(["prospect", "active", "dormant", "churned"]);
  return allowed.has(s) ? s : null;
};

const buildVisibilityMatch = (req) => {
  const includeLeadCustomers =
    String(req.query?.includeLeadCustomers || "").toLowerCase() === "true";

  // admin can see lead customers if requested
  if (includeLeadCustomers && isAdminOrSuperAdmin(req)) return {};

  // default only direct customers
  return { origin: "direct" };
};

const clampLimit = (v, min = 1, max = 50, fallback = 20) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(n)));
};

const toObjectIdOrNull = (id) => {
  if (!id) return null;
  if (!mongoose.isValidObjectId(id)) return null;
  return new mongoose.Types.ObjectId(String(id));
};

const clampYearOrNull = (v) => {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  const y = Math.trunc(n);
  if (y < 1900 || y > 2200) return null;
  return y;
};

const escapeRegex = (str) => String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * CustomerFiles normalizer
 */
const normalizeCustomerFiles = (files, reqUserId) => {
  if (files === undefined) return { files: undefined };
  if (!Array.isArray(files)) return { error: "customerFiles must be an array." };
  if (files.length > 200) return { error: "Too many customerFiles (max 200)." };

  const out = [];
  for (const f of files) {
    if (!f || typeof f !== "object") continue;

    const key = String(f.key ?? "").trim();
    const url = String(f.url ?? "").trim();
    const originalName = String(f.originalName ?? "").trim();

    if (!key || !url || !originalName) continue;

    out.push({
      key,
      url,
      originalName,
      displayName: String(f.displayName ?? "").trim(),
      mimeType: f.mimeType ? String(f.mimeType).trim() : undefined,
      size: Number.isFinite(Number(f.size)) ? Number(f.size) : 0,
      uploadedBy: reqUserId ?? null,
      uploadedAt: new Date(),
    });
  }

  return { files: out };
};

const sanitizeSubEngagementIds = (arr) => {
  if (!Array.isArray(arr)) return [];
  const out = [];
  for (const v of arr) {
    if (mongoose.isValidObjectId(v)) out.push(new mongoose.Types.ObjectId(String(v)));
  }
  const seen = new Set();
  const uniq = [];
  for (const id of out) {
    const s = String(id);
    if (seen.has(s)) continue;
    seen.add(s);
    uniq.push(id);
  }
  return uniq;
};

const validateEngagementSelection = async ({ engagementTemplateId, subEngagementIds }) => {
  const tplId = toObjectIdOrNull(engagementTemplateId);
  if (!tplId) return { error: "Invalid engagementTemplateId." };

  const tpl = await EngagementTemplate.findById(tplId)
    .select("_id subEngagements isActive")
    .lean();

  if (!tpl) return { error: "Engagement type not found." };
  if (!tpl.isActive) return { error: "Engagement type is inactive." };

  const selected = sanitizeSubEngagementIds(subEngagementIds);

  const allowedIds = new Set((tpl.subEngagements || []).map((s) => String(s._id)));
  for (const sid of selected) {
    if (!allowedIds.has(String(sid))) {
      return { error: "One or more subEngagementIds are invalid for this engagement type." };
    }
  }

  return { tplId, subIds: selected };
};

/* ------------------ list filter helpers ------------------ */

const parseSubEngagementIdsQuery = (v) => {
  if (!v) return [];
  if (Array.isArray(v)) return sanitizeSubEngagementIds(v);
  const s = String(v);
  const parts = s.split(",").map((x) => x.trim()).filter(Boolean);
  return sanitizeSubEngagementIds(parts);
};

const normalizeSubMatch = (v) => {
  const s = String(v ?? "any").toLowerCase();
  return s === "all" ? "all" : "any";
};

const buildEngagementElemMatch = (req) => {
  const templateId = toObjectIdOrNull(req.query.engagementTemplateId);
  const year = clampYearOrNull(req.query.engagementYear);
  const subMatch = normalizeSubMatch(req.query.subMatch);
  const subIds = parseSubEngagementIdsQuery(req.query.subEngagementIds);

  if (!req.query.engagementTemplateId && !req.query.engagementYear && !req.query.subEngagementIds) {
    return { elemMatch: null, error: null };
  }

  if (!templateId) {
    return {
      elemMatch: null,
      error: "Valid engagementTemplateId is required for engagement filtering.",
    };
  }

  const elem = { engagementTemplateId: templateId };
  if (year) elem.year = year;

  if (subIds.length) {
    if (subMatch === "all") elem.subEngagementIds = { $all: subIds };
    else elem.subEngagementIds = { $in: subIds };
  }

  return { elemMatch: elem, error: null };
};

const buildCustomerListMatch = (req) => {
  const visibilityMatch = buildVisibilityMatch(req);

  const match = isAdminOrSuperAdmin(req)
    ? { ...visibilityMatch }
    : {
        ...visibilityMatch,
        $or: [{ assignedTo: req.user._id }, { createdBy: req.user._id }],
      };

  if (req.query.status !== undefined) {
    match.status = normalizeStatus(req.query.status);
  }

  if (req.query.customerType !== undefined) {
    match.customerType = normalizeCustomerType(req.query.customerType);
  }

  if (req.query.lifecycleStage !== undefined) {
    const ls = normalizeLifecycleStage(req.query.lifecycleStage);
    if (ls) match.lifecycleStage = ls;
    else return { match: null, error: "Invalid lifecycleStage." };
  }

  if (req.query.tags !== undefined) {
    const tagsRaw = String(req.query.tags || "").trim();
    const tags = tagsRaw
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 50);

    const tagsMatch = String(req.query.tagsMatch || "any").toLowerCase() === "all" ? "all" : "any";

    if (tags.length) {
      match.tags = tagsMatch === "all" ? { $all: tags } : { $in: tags };
    }
  }

  // text search if requested
  if (req.query.q !== undefined) {
    const q = String(req.query.q || "").trim();
    if (q) match.$text = { $search: q };
  }

  return { match, error: null };
};

/* =========================================================
   EMPLOYEE SEARCH FOR ASSIGN (optimized)
   GET /customers/employees/search?q=&active=true|false|all&limit=&cursor=<userId>
========================================================= */

export const searchEmployeesForCustomerAssign = async (req, res) => {
  try {
    if (!isAdminOrSuperAdmin(req)) {
      return res.status(403).json({ message: "Not authorized." });
    }

    const limit = clampLimit(req.query.limit, 1, 100, 20);
    const cursorId = toObjectIdOrNull(req.query.cursor);

    const qRaw = String(req.query.q ?? "").trim();
    const q = qRaw.toLowerCase();
    const active = String(req.query.active ?? "true").toLowerCase();

    const filter = { role: "employee" };

    if (active === "true") filter.isActive = true;
    else if (active === "false") filter.isActive = false;

    // ✅ Prefer indexed prefix search using nameLower
    // - If q looks like email, do contains match on email (still indexed on email but regex won't use it fully)
    // - Else do prefix match on nameLower (uses index: role+isActive+nameLower)
    if (q) {
      const safe = escapeRegex(q);
      const isEmailish = q.includes("@");

      if (isEmailish) {
        filter.email = new RegExp(safe, "i");
      } else {
        filter.$or = [
          { nameLower: new RegExp(`^${safe}`, "i") },
          { email: new RegExp(`^${safe}`, "i") },
        ];
      }
    }

    if (cursorId) filter._id = { $lt: cursorId };

    const rows = await User.find(filter)
      .select("_id name email role isActive avatarUrl createdAt")
      .sort({ _id: -1 })
      .limit(limit + 1)
      .lean();

    const hasMore = rows.length > limit;
    const employees = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = employees.length ? String(employees[employees.length - 1]._id) : null;

    return res.status(200).json({ count: employees.length, employees, hasMore, nextCursor });
  } catch (err) {
    return res.status(500).json({
      message: "Server error in searchEmployeesForCustomerAssign.",
      error: err.message,
    });
  }
};

/* ------------------ controllers ------------------ */

/**
 * CREATE CUSTOMER
 * POST /customers
 */
export const createCustomer = async (req, res) => {
  try {
    const {
      name,
      companyName,
      email,
      phone,
      address,
      contactPerson,
      status,
      customerType,
      customerFiles,
      engagementYear,
      engagementTemplateId,
      subEngagementIds,
    } = req.body;

    if (!name || !String(name).trim()) {
      return res.status(400).json({ message: "Customer name is required." });
    }

    const cp = normalizeContactPerson(contactPerson);
    if (!cp?.name || !String(cp.name).trim()) {
      return res.status(400).json({ message: "Contact person name is required." });
    }

    const { files: normalizedFiles, error: filesErr } = normalizeCustomerFiles(
      customerFiles,
      req.user._id
    );
    if (filesErr) return res.status(400).json({ message: filesErr });

    // engagement required
    const y = clampYearOrNull(engagementYear);
    if (!y) return res.status(400).json({ message: "engagementYear is required." });
    if (!engagementTemplateId)
      return res.status(400).json({ message: "engagementTemplateId is required." });

    const val = await validateEngagementSelection({ engagementTemplateId, subEngagementIds });
    if (val.error) return res.status(400).json({ message: val.error });

    const engagements = [
      {
        year: y,
        engagementTemplateId: val.tplId,
        subEngagementIds: val.subIds,
        updatedAt: new Date(),
        updatedBy: req.user._id,
      },
    ];

    const payload = {
      name: String(name).trim(),
      companyName: companyName ? String(companyName).trim() : undefined,
      email: email ? String(email).trim().toLowerCase() : undefined,
      phone: phone ? String(phone).trim() : undefined,
      address: address ? String(address).trim() : "",

      contactPerson: {
        name: String(cp.name).trim(),
        email: cp.email ? String(cp.email).trim().toLowerCase() : undefined,
        phone: cp.phone ? String(cp.phone).trim() : undefined,
        designation: cp.designation ? String(cp.designation).trim() : undefined,
      },

      customerType: normalizeCustomerType(customerType),
      status: normalizeStatus(status),

      createdBy: req.user._id,
      assignedTo: req.user.role === "employee" ? [req.user._id] : [],

      origin: "direct",
      leadId: null,

      customerFiles: normalizedFiles ?? [],
      engagements,

      crmTasks: [],
    };

    const customer = await Customer.create(payload);

    // ✅ FIX: invalidate dashboard cache so counts stay correct immediately
    invalidateDashboardCache();

    return res.status(201).json({
      message: "Customer created.",
      customer: {
        _id: customer._id,
        name: customer.name,
        companyName: customer.companyName,
        status: customer.status,
        customerType: customer.customerType,
        origin: customer.origin,
        createdAt: customer.createdAt,
      },
    });
  } catch (err) {
    return res.status(500).json({
      message: "Server error in createCustomer.",
      error: err.message,
    });
  }
};

/**
 * GET CUSTOMERS
 * GET /customers
 */
export const getCustomers = async (req, res) => {
  try {
    const limit = clampLimit(req.query.limit, 1, 50, 20);
    const cursorId = toObjectIdOrNull(req.query.cursor);

    const { match, error: matchErr } = buildCustomerListMatch(req);
    if (matchErr) return res.status(400).json({ message: matchErr });
    if (!match) return res.status(400).json({ message: "Invalid filters." });

    const { elemMatch, error: engagementFilterErr } = buildEngagementElemMatch(req);
    if (engagementFilterErr) return res.status(400).json({ message: engagementFilterErr });

    const pipeline = [
      { $match: match },
      ...(elemMatch ? [{ $match: { engagements: { $elemMatch: elemMatch } } }] : []),
      ...(cursorId ? [{ $match: { _id: { $lt: cursorId } } }] : []),

      { $sort: { _id: -1 } },
      { $limit: limit + 1 },

      {
        $project: {
          name: 1,
          companyName: 1,
          email: 1,
          phone: 1,
          address: 1,
          contactPerson: 1,
          status: 1,
          customerType: 1,
          lifecycleStage: 1,
          tags: 1,
          origin: 1,
          leadId: 1,
          assignedTo: 1,
          createdBy: 1,
          createdAt: 1,
          updatedAt: 1,
        },
      },

      {
        $lookup: {
          from: "users",
          localField: "assignedTo",
          foreignField: "_id",
          as: "assignedToUsers",
          pipeline: [{ $project: { name: 1, email: 1, role: 1 } }],
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "createdBy",
          foreignField: "_id",
          as: "createdByUser",
          pipeline: [{ $project: { name: 1, email: 1, role: 1 } }],
        },
      },
      {
        $addFields: {
          assignedTo: "$assignedToUsers",
          createdBy: { $arrayElemAt: ["$createdByUser", 0] },
        },
      },
      { $project: { assignedToUsers: 0, createdByUser: 0 } },
    ];

    const rows = await Customer.aggregate(pipeline).allowDiskUse(true);

    const hasMore = rows.length > limit;
    const customers = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = customers.length ? String(customers[customers.length - 1]._id) : null;

    return res.status(200).json({ count: customers.length, hasMore, nextCursor, customers });
  } catch (err) {
    return res.status(500).json({
      message: "Server error in getCustomers.",
      error: err.message,
    });
  }
};

/**
 * GET SINGLE CUSTOMER
 * GET /customers/:id
 */
export const getCustomerById = async (req, res) => {
  try {
    const customerId = toObjectIdOrNull(req.params.id);
    if (!customerId) return res.status(400).json({ message: "Invalid customer id." });

    const visibilityMatch = buildVisibilityMatch(req);

    const baseMatch = isAdminOrSuperAdmin(req)
      ? { _id: customerId, ...visibilityMatch }
      : {
          _id: customerId,
          ...visibilityMatch,
          $or: [{ assignedTo: req.user._id }, { createdBy: req.user._id }],
        };

    const pipeline = [
      { $match: baseMatch },
      {
        $project: {
          name: 1,
          companyName: 1,
          email: 1,
          phone: 1,
          address: 1,
          contactPerson: 1,
          secondaryContacts: 1,
          tags: 1,
          lifecycleStage: 1,
          billingAddress: 1,
          shippingAddress: 1,
          status: 1,
          customerType: 1,
          origin: 1,
          leadId: 1,
          assignedTo: 1,
          createdBy: 1,
          customerFiles: 1,
          engagements: 1,
          createdAt: 1,
          updatedAt: 1,
        },
      },
      {
        $lookup: {
          from: "engagementtemplates",
          localField: "engagements.engagementTemplateId",
          foreignField: "_id",
          as: "engagementTemplateDocs",
        },
      },
      {
        $addFields: {
          engagements: {
            $map: {
              input: "$engagements",
              as: "e",
              in: {
                _id: "$$e._id",
                year: "$$e.year",
                engagementTemplateId: "$$e.engagementTemplateId",
                subEngagementIds: "$$e.subEngagementIds",
                updatedAt: "$$e.updatedAt",
                updatedBy: "$$e.updatedBy",
                engagementTitle: {
                  $let: {
                    vars: {
                      tpl: {
                        $arrayElemAt: [
                          {
                            $filter: {
                              input: "$engagementTemplateDocs",
                              as: "t",
                              cond: { $eq: ["$$t._id", "$$e.engagementTemplateId"] },
                            },
                          },
                          0,
                        ],
                      },
                    },
                    in: "$$tpl.title",
                  },
                },
                subEngagements: {
                  $let: {
                    vars: {
                      tpl: {
                        $arrayElemAt: [
                          {
                            $filter: {
                              input: "$engagementTemplateDocs",
                              as: "t",
                              cond: { $eq: ["$$t._id", "$$e.engagementTemplateId"] },
                            },
                          },
                          0,
                        ],
                      },
                    },
                    in: {
                      $map: {
                        input: {
                          $filter: {
                            input: "$$tpl.subEngagements",
                            as: "se",
                            cond: { $in: ["$$se._id", "$$e.subEngagementIds"] },
                          },
                        },
                        as: "picked",
                        in: { _id: "$$picked._id", text: "$$picked.text" },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      { $project: { engagementTemplateDocs: 0 } },
      {
        $lookup: {
          from: "users",
          localField: "assignedTo",
          foreignField: "_id",
          as: "assignedTo",
          pipeline: [{ $project: { name: 1, email: 1, role: 1 } }],
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "createdBy",
          foreignField: "_id",
          as: "createdByArr",
          pipeline: [{ $project: { name: 1, email: 1, role: 1 } }],
        },
      },
      { $addFields: { createdBy: { $arrayElemAt: ["$createdByArr", 0] } } },
      { $project: { createdByArr: 0 } },
    ];

    const rows = await Customer.aggregate(pipeline);
    if (!rows.length) return res.status(404).json({ message: "Customer not found." });

    return res.status(200).json({ customer: rows[0] });
  } catch (err) {
    return res.status(500).json({
      message: "Server error in getCustomerById.",
      error: err.message,
    });
  }
};

/**
 * GET CUSTOMER TASKS
 * GET /customers/:id/tasks?limit=20&cursor=<taskId>
 */
export const getCustomerTasks = async (req, res) => {
  try {
    const customerId = toObjectIdOrNull(req.params.id);
    if (!customerId) return res.status(400).json({ message: "Invalid customer id." });

    const limit = clampLimit(req.query.limit, 1, 50, 20);
    const taskCursor = toObjectIdOrNull(req.query.cursor);

    const visibilityMatch = buildVisibilityMatch(req);

    const customerMatch = isAdminOrSuperAdmin(req)
      ? { _id: customerId, ...visibilityMatch }
      : {
          _id: customerId,
          ...visibilityMatch,
          $or: [{ assignedTo: req.user._id }, { createdBy: req.user._id }],
        };

    const meId = new mongoose.Types.ObjectId(req.user._id);

    const pipeline = [
      { $match: customerMatch },
      { $project: { crmTasks: 1 } },
      { $unwind: "$crmTasks" },

      ...(isAdminOrSuperAdmin(req) ? [] : [{ $match: { "crmTasks.assignedTo": meId } }]),
      ...(taskCursor ? [{ $match: { "crmTasks._id": { $lt: taskCursor } } }] : []),

      { $sort: { "crmTasks._id": -1 } },
      { $limit: limit + 1 },
      { $replaceRoot: { newRoot: "$crmTasks" } },

      {
        $project: {
          title: 1,
          subtitles: 1,
          templateId: 1,
          description: 1,
          status: 1,
          dueAt: 1,
          completedAt: 1,
          assignedTo: 1,
          createdBy: 1,
          reminders: 1,
          createdAt: 1,
          updatedAt: 1,
        },
      },
    ];

    const rows = await Customer.aggregate(pipeline).allowDiskUse(true);

    const hasMore = rows.length > limit;
    const tasks = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = tasks.length ? String(tasks[tasks.length - 1]._id) : null;

    return res.status(200).json({ count: tasks.length, hasMore, nextCursor, tasks });
  } catch (err) {
    return res.status(500).json({
      message: "Server error in getCustomerTasks.",
      error: err.message,
    });
  }
};

/**
 * UPDATE CUSTOMER
 * PATCH /customers/:id
 */
export const updateCustomer = async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id).select(
      "name companyName email phone address contactPerson status createdBy origin leadId customerType customerFiles secondaryContacts tags lifecycleStage billingAddress shippingAddress"
    );

    if (!customer) return res.status(404).json({ message: "Customer not found." });

    const isOwner = String(customer.createdBy?._id ?? customer.createdBy) === String(req.user._id);

    if (!isAdminOrSuperAdmin(req) && !isOwner) {
      return res.status(403).json({ message: "You cannot update this customer." });
    }

    if (req.body.name !== undefined) customer.name = String(req.body.name).trim();

    if (req.body.companyName !== undefined) {
      const v = String(req.body.companyName || "").trim();
      customer.companyName = v || undefined;
    }

    if (req.body.email !== undefined) {
      const v = String(req.body.email || "").trim().toLowerCase();
      customer.email = v || undefined;
    }

    if (req.body.phone !== undefined) {
      const v = String(req.body.phone || "").trim();
      customer.phone = v || undefined;
    }

    if (req.body.address !== undefined) customer.address = String(req.body.address || "").trim();

    if (req.body.contactPerson !== undefined) {
      const cp = normalizeContactPerson(req.body.contactPerson);
      if (!cp?.name || !String(cp.name).trim()) {
        return res.status(400).json({ message: "Contact person name is required." });
      }

      customer.contactPerson = {
        name: String(cp.name).trim(),
        email: cp.email ? String(cp.email).trim().toLowerCase() : undefined,
        phone: cp.phone ? String(cp.phone).trim() : undefined,
        designation: cp.designation ? String(cp.designation).trim() : undefined,
      };
    }

    if (req.body.status !== undefined) customer.status = normalizeStatus(req.body.status);

    if (req.body.customerType !== undefined)
      customer.customerType = normalizeCustomerType(req.body.customerType);

    if (req.body.lifecycleStage !== undefined) {
      const ls = normalizeLifecycleStage(req.body.lifecycleStage);
      if (!ls) return res.status(400).json({ message: "Invalid lifecycleStage." });
      customer.lifecycleStage = ls;
    }

    if (req.body.tags !== undefined) {
      const tags = Array.isArray(req.body.tags)
        ? req.body.tags.map((t) => String(t).trim()).filter(Boolean).slice(0, 50)
        : [];
      customer.tags = tags;
    }

    if (req.body.secondaryContacts !== undefined) {
      customer.secondaryContacts = Array.isArray(req.body.secondaryContacts)
        ? req.body.secondaryContacts
        : [];
    }

    if (req.body.billingAddress !== undefined) {
      customer.billingAddress = req.body.billingAddress || {};
    }

    if (req.body.shippingAddress !== undefined) {
      customer.shippingAddress = req.body.shippingAddress || {};
    }

    if (req.body.customerFiles !== undefined) {
      const { files, error } = normalizeCustomerFiles(req.body.customerFiles, req.user._id);
      if (error) return res.status(400).json({ message: error });
      customer.customerFiles = files;
    }

    await customer.save();

    // ✅ FIX: invalidate dashboard cache on updates too (counts + recent lists)
    invalidateDashboardCache();

    return res.status(200).json({ message: "Customer updated.", customer });
  } catch (err) {
    return res.status(500).json({
      message: "Server error in updateCustomer.",
      error: err.message,
    });
  }
};

/**
 * UPSERT CUSTOMER ENGAGEMENT
 * PATCH /customers/:id/engagements
 */
export const upsertCustomerEngagement = async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id).select(
      "_id createdBy assignedTo engagements origin"
    );
    if (!customer) return res.status(404).json({ message: "Customer not found." });

    const isOwner = String(customer.createdBy) === String(req.user._id);

    if (!isAdminOrSuperAdmin(req) && !isOwner) {
      return res.status(403).json({ message: "You cannot update engagement for this customer." });
    }

    const year = clampYearOrNull(req.body.year);
    if (!year) return res.status(400).json({ message: "Valid year is required." });

    const engagementTemplateId = req.body.engagementTemplateId;
    if (!engagementTemplateId)
      return res.status(400).json({ message: "engagementTemplateId is required." });

    const val = await validateEngagementSelection({
      engagementTemplateId,
      subEngagementIds: req.body.subEngagementIds,
    });
    if (val.error) return res.status(400).json({ message: val.error });

    const idx = (customer.engagements || []).findIndex((e) => Number(e.year) === Number(year));

    const next = {
      year,
      engagementTemplateId: val.tplId,
      subEngagementIds: val.subIds,
      updatedAt: new Date(),
      updatedBy: req.user._id,
    };

    if (idx >= 0) {
      customer.engagements[idx] = { ...customer.engagements[idx].toObject?.(), ...next };
    } else {
      customer.engagements.push(next);
    }

    customer.engagements.sort((a, b) => Number(b.year) - Number(a.year));
    await customer.save();

    invalidateDashboardCache();

    return res.status(200).json({
      message: "Customer engagement updated.",
      engagements: customer.engagements,
    });
  } catch (err) {
    return res.status(500).json({
      message: "Server error in upsertCustomerEngagement.",
      error: err.message,
    });
  }
};

/**
 * DELETE CUSTOMER (admin/superadmin only)
 * DELETE /customers/:id
 */
export const deleteCustomer = async (req, res) => {
  try {
    if (!isAdminOrSuperAdmin(req)) return res.status(403).json({ message: "Not authorized." });

    const customer = await Customer.findByIdAndDelete(req.params.id).select("_id");
    if (!customer) return res.status(404).json({ message: "Customer not found." });

    // ✅ FIX: clear dashboard cache so counts don't stay stale after delete
    invalidateDashboardCache();

    return res.status(200).json({ message: "Customer deleted." });
  } catch (err) {
    return res.status(500).json({
      message: "Server error in deleteCustomer.",
      error: err.message,
    });
  }
};

/* =========================================================
   ASSIGNMENT
========================================================= */

/**
 * PATCH /customers/:id/assign
 * body:
 * - { employeeId: "..." }
 * - { employeeIds: ["..",".."] }
 * - { employeeIds: [] } ✅ clear
 */
export const assignCustomer = async (req, res) => {
  try {
    if (!isAdminOrSuperAdmin(req)) {
      return res.status(403).json({ message: "Not authorized." });
    }

    const { employeeId, employeeIds } = req.body;

    const normalizeIds = (arr) => {
      const out = [];
      const seen = new Set();
      for (const v of arr) {
        const s = String(v ?? "").trim();
        if (!s) continue;
        if (!mongoose.isValidObjectId(s)) continue;
        if (seen.has(s)) continue;
        seen.add(s);
        out.push(s);
      }
      return out;
    };

    let ids = null;

    if (employeeIds !== undefined) {
      if (!Array.isArray(employeeIds)) {
        return res.status(400).json({ message: "employeeIds must be an array." });
      }
      ids = normalizeIds(employeeIds); // can be []
    } else if (employeeId !== undefined) {
      const one = normalizeIds([employeeId]);
      ids = one.length ? [one[0]] : [];
    } else {
      return res.status(400).json({
        message:
          "Provide employeeId (single) or employeeIds (multiple). To clear, send employeeIds: [].",
      });
    }

    if (ids.length > 0) {
      const found = await User.countDocuments({
        _id: { $in: ids },
        role: "employee",
        isActive: true,
      });

      if (found !== ids.length) {
        return res.status(404).json({ message: "One or more employees not found or inactive." });
      }
    }

    const updated = await Customer.findByIdAndUpdate(
      req.params.id,
      { $set: { assignedTo: ids } },
      { new: true }
    ).select("name assignedTo createdBy status origin customerType createdAt");

    if (!updated) return res.status(404).json({ message: "Customer not found." });

    invalidateDashboardCache();

    return res.status(200).json({
      message: ids.length === 0 ? "Customer assignments cleared." : "Customer assigned successfully.",
      customer: updated,
    });
  } catch (err) {
    return res.status(500).json({
      message: "Server error in assignCustomer.",
      error: err.message,
    });
  }
};

/* =========================================================
   CRM ENDPOINTS
========================================================= */

export const getCustomerSummary = async (req, res) => {
  try {
    const customerId = toObjectIdOrNull(req.params.id);
    if (!customerId) return res.status(400).json({ message: "Invalid customer id." });

    const visibilityMatch = buildVisibilityMatch(req);

    const customer = await Customer.findOne(
      isAdminOrSuperAdmin(req)
        ? { _id: customerId, ...visibilityMatch }
        : {
            _id: customerId,
            ...visibilityMatch,
            $or: [{ assignedTo: req.user._id }, { createdBy: req.user._id }],
          }
    )
      .select("_id name companyName createdBy assignedTo crmTasks")
      .lean();

    if (!customer) return res.status(404).json({ message: "Customer not found." });

    const tasks = Array.isArray(customer.crmTasks) ? customer.crmTasks : [];
    const taskCounts = {
      pending: tasks.filter((t) => t.status === "pending").length,
      in_progress: tasks.filter((t) => t.status === "in_progress").length,
      done: tasks.filter((t) => t.status === "done").length,
    };

    const [dealOpen, dealWon, dealLost, ordersCount, invoicesCount, lastActivity] =
      await Promise.all([
        Deal.countDocuments({ customerId, stage: { $nin: ["won", "lost"] } }),
        Deal.countDocuments({ customerId, stage: "won" }),
        Deal.countDocuments({ customerId, stage: "lost" }),
        Order.countDocuments({ customerId }),
        Invoice.countDocuments({ customerId }),
        Activity.findOne({ customerId })
          .sort({ _id: -1 })
          .select("type text createdAt scheduledAt isDone")
          .lean(),
      ]);

    return res.status(200).json({
      customerId: String(customerId),
      customerName: customer.name,
      companyName: customer.companyName,
      deals: { open: dealOpen, won: dealWon, lost: dealLost },
      orders: { count: ordersCount },
      invoices: { count: invoicesCount },
      tasks: taskCounts,
      lastActivity: lastActivity || null,
    });
  } catch (err) {
    return res.status(500).json({
      message: "Server error in getCustomerSummary.",
      error: err.message,
    });
  }
};

export const getCustomerTimeline = async (req, res) => {
  try {
    const customerId = toObjectIdOrNull(req.params.id);
    if (!customerId) return res.status(400).json({ message: "Invalid customer id." });

    const visibilityMatch = buildVisibilityMatch(req);

    const customer = await Customer.findOne(
      isAdminOrSuperAdmin(req)
        ? { _id: customerId, ...visibilityMatch }
        : {
            _id: customerId,
            ...visibilityMatch,
            $or: [{ assignedTo: req.user._id }, { createdBy: req.user._id }],
          }
    )
      .select("_id createdBy assignedTo")
      .lean();

    if (!customer) return res.status(404).json({ message: "Customer not found." });
    if (!canAccessCustomerDoc(customer, req)) return res.status(403).json({ message: "No access." });

    const limit = clampLimit(req.query.limit, 1, 100, 20);
    const cursor = toObjectIdOrNull(req.query.cursor);

    const filter = { customerId };
    if (cursor) filter._id = { $lt: cursor };

    const rows = await Activity.find(filter)
      .sort({ _id: -1 })
      .limit(limit + 1)
      .populate("createdBy", "name email role")
      .lean();

    const hasMore = rows.length > limit;
    const activities = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = activities.length ? String(activities[activities.length - 1]._id) : null;

    return res.status(200).json({ count: activities.length, hasMore, nextCursor, activities });
  } catch (err) {
    return res.status(500).json({
      message: "Server error in getCustomerTimeline.",
      error: err.message,
    });
  }
};

export const getCustomerDeals = async (req, res) => {
  try {
    const customerId = toObjectIdOrNull(req.params.id);
    if (!customerId) return res.status(400).json({ message: "Invalid customer id." });

    const visibilityMatch = buildVisibilityMatch(req);

    const customer = await Customer.findOne(
      isAdminOrSuperAdmin(req)
        ? { _id: customerId, ...visibilityMatch }
        : {
            _id: customerId,
            ...visibilityMatch,
            $or: [{ assignedTo: req.user._id }, { createdBy: req.user._id }],
          }
    )
      .select("_id createdBy assignedTo")
      .lean();

    if (!customer) return res.status(404).json({ message: "Customer not found." });
    if (!canAccessCustomerDoc(customer, req)) return res.status(403).json({ message: "No access." });

    const limit = clampLimit(req.query.limit, 1, 100, 20);
    const cursor = toObjectIdOrNull(req.query.cursor);
    const stage = req.query.stage ? String(req.query.stage).toLowerCase() : null;

    const filter = { customerId };
    if (cursor) filter._id = { $lt: cursor };
    if (stage) filter.stage = stage;

    const rows = await Deal.find(filter)
      .sort({ _id: -1 })
      .limit(limit + 1)
      .populate("ownerId", "name email role")
      .lean();

    const hasMore = rows.length > limit;
    const deals = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = deals.length ? String(deals[deals.length - 1]._id) : null;

    return res.status(200).json({ count: deals.length, hasMore, nextCursor, deals });
  } catch (err) {
    return res.status(500).json({
      message: "Server error in getCustomerDeals.",
      error: err.message,
    });
  }
};

export const getCustomerOrders = async (req, res) => {
  try {
    const customerId = toObjectIdOrNull(req.params.id);
    if (!customerId) return res.status(400).json({ message: "Invalid customer id." });

    const visibilityMatch = buildVisibilityMatch(req);

    const customer = await Customer.findOne(
      isAdminOrSuperAdmin(req)
        ? { _id: customerId, ...visibilityMatch }
        : {
            _id: customerId,
            ...visibilityMatch,
            $or: [{ assignedTo: req.user._id }, { createdBy: req.user._id }],
          }
    )
      .select("_id createdBy assignedTo")
      .lean();

    if (!customer) return res.status(404).json({ message: "Customer not found." });
    if (!canAccessCustomerDoc(customer, req)) return res.status(403).json({ message: "No access." });

    const limit = clampLimit(req.query.limit, 1, 100, 20);
    const cursor = toObjectIdOrNull(req.query.cursor);
    const status = req.query.status ? String(req.query.status).toLowerCase() : null;

    const filter = { customerId };
    if (cursor) filter._id = { $lt: cursor };
    if (status) filter.status = status;

    const rows = await Order.find(filter).sort({ _id: -1 }).limit(limit + 1).lean();

    const hasMore = rows.length > limit;
    const orders = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = orders.length ? String(orders[orders.length - 1]._id) : null;

    return res.status(200).json({ count: orders.length, hasMore, nextCursor, orders });
  } catch (err) {
    return res.status(500).json({
      message: "Server error in getCustomerOrders.",
      error: err.message,
    });
  }
};

export const getCustomerInvoices = async (req, res) => {
  try {
    const customerId = toObjectIdOrNull(req.params.id);
    if (!customerId) return res.status(400).json({ message: "Invalid customer id." });

    const visibilityMatch = buildVisibilityMatch(req);

    const customer = await Customer.findOne(
      isAdminOrSuperAdmin(req)
        ? { _id: customerId, ...visibilityMatch }
        : {
            _id: customerId,
            ...visibilityMatch,
            $or: [{ assignedTo: req.user._id }, { createdBy: req.user._id }],
          }
    )
      .select("_id createdBy assignedTo")
      .lean();

    if (!customer) return res.status(404).json({ message: "Customer not found." });
    if (!canAccessCustomerDoc(customer, req)) return res.status(403).json({ message: "No access." });

    const limit = clampLimit(req.query.limit, 1, 100, 20);
    const cursor = toObjectIdOrNull(req.query.cursor);
    const status = req.query.status ? String(req.query.status).toLowerCase() : null;

    const filter = { customerId };
    if (cursor) filter._id = { $lt: cursor };
    if (status) filter.status = status;

    const rows = await Invoice.find(filter).sort({ _id: -1 }).limit(limit + 1).lean();

    const hasMore = rows.length > limit;
    const invoices = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = invoices.length ? String(invoices[invoices.length - 1]._id) : null;

    return res.status(200).json({ count: invoices.length, hasMore, nextCursor, invoices });
  } catch (err) {
    return res.status(500).json({
      message: "Server error in getCustomerInvoices.",
      error: err.message,
    });
  }
};
