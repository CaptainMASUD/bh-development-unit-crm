// controllers/customer.controller.js
import mongoose from "mongoose";
import Customer from "../models/customer.model.js";
import User from "../models/user.model.js";
import EngagementTemplate from "../models/engagementTemplate.model.js";

/* ------------------ helpers ------------------ */

const isAdminOrSuperAdmin = (userOrReq) => {
  const role = userOrReq?.user?.role ?? userOrReq?.role;
  return role === "admin" || role === "superadmin";
};

const normalizeContactPerson = (contactPerson) => {
  if (!contactPerson) return null;
  if (typeof contactPerson === "string") return { name: contactPerson };
  if (typeof contactPerson === "object") return contactPerson;
  return null;
};

const normalizeStatus = (status) => {
  if (!status) return "in_progress";
  const s = String(status).toLowerCase();
  if (s === "pending" || s === "in_progress" || s === "complete") return s;
  return "in_progress";
};

const normalizeCustomerType = (v) => {
  const s = String(v ?? "").trim().toLowerCase();
  if (!s) return "new";
  if (s === "new") return "new";
  if (s === "returning" || s === "existing" || s === "repeat") return "returning";
  return "new";
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

/**
 * ✅ Customer Files normalizer (customerFiles uses its OWN schema)
 * Expected: [{ key, url, originalName, displayName?, mimeType?, size? }]
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
  // de-dupe
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

const validateEngagementSelection = async ({
  engagementTemplateId,
  subEngagementIds,
}) => {
  const tplId = toObjectIdOrNull(engagementTemplateId);
  if (!tplId) return { error: "Invalid engagementTemplateId." };

  const tpl = await EngagementTemplate.findById(tplId)
    .select("_id subEngagements isActive")
    .lean();

  if (!tpl) return { error: "Engagement type not found." };
  if (!tpl.isActive) return { error: "Engagement type is inactive." };

  const selected = sanitizeSubEngagementIds(subEngagementIds);

  // validate selected ids against template
  const allowedIds = new Set((tpl.subEngagements || []).map((s) => String(s._id)));
  for (const sid of selected) {
    if (!allowedIds.has(String(sid))) {
      return { error: "One or more subEngagementIds are invalid for this engagement type." };
    }
  }

  return { tplId, subIds: selected };
};

/* ------------------ NEW: list filter helpers ------------------ */

/**
 * Parse query subEngagementIds from:
 * - subEngagementIds=1,2,3
 * - OR repeated: subEngagementIds=1&subEngagementIds=2
 */
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

/**
 * Build Mongo filter for engagements:
 * - engagementTemplateId required to apply engagement filter
 * - optional engagementYear
 * - optional subEngagementIds + match mode (any/all)
 */
const buildEngagementElemMatch = (req) => {
  const templateId = toObjectIdOrNull(req.query.engagementTemplateId);
  const year = clampYearOrNull(req.query.engagementYear);
  const subMatch = normalizeSubMatch(req.query.subMatch);
  const subIds = parseSubEngagementIdsQuery(req.query.subEngagementIds);

  // if user didn't request engagement filtering, return null
  if (!req.query.engagementTemplateId && !req.query.engagementYear && !req.query.subEngagementIds) {
    return { elemMatch: null, error: null };
  }

  // We require engagementTemplateId for stable filtering by "type"
  if (!templateId) {
    return { elemMatch: null, error: "Valid engagementTemplateId is required for engagement filtering." };
  }

  const elem = { engagementTemplateId: templateId };

  if (year) elem.year = year;

  if (subIds.length) {
    if (subMatch === "all") {
      elem.subEngagementIds = { $all: subIds };
    } else {
      elem.subEngagementIds = { $in: subIds };
    }
  }

  return { elemMatch: elem, error: null };
};

/* ------------------ controllers ------------------ */

/**
 * CREATE CUSTOMER
 * POST /customers
 *
 * ✅ REQUIRED:
 * - engagementYear
 * - engagementTemplateId
 * - subEngagementIds? (optional)
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

    // ✅ engagement is REQUIRED
    const y = clampYearOrNull(engagementYear);
    if (!y) {
      return res.status(400).json({ message: "engagementYear is required." });
    }
    if (!engagementTemplateId) {
      return res.status(400).json({ message: "engagementTemplateId is required." });
    }

    const val = await validateEngagementSelection({
      engagementTemplateId,
      subEngagementIds,
    });
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
 * GET CUSTOMERS (FAST LIST + FILTER)
 * GET /customers
 *
 * Pagination:
 * - limit=20
 * - cursor=<lastId>
 *
 * Engagement filter:
 * - engagementTemplateId=<ObjectId>   (required if using engagement filter)
 * - subEngagementIds=<id1,id2>       (optional)
 * - subMatch=any|all                 (optional, default any)
 * - engagementYear=2025              (optional)
 *
 * Other:
 * - includeLeadCustomers=true (admin only)
 */
export const getCustomers = async (req, res) => {
  try {
    const limit = clampLimit(req.query.limit, 1, 50, 20);
    const cursorId = toObjectIdOrNull(req.query.cursor);

    const visibilityMatch = buildVisibilityMatch(req);

    const match = isAdminOrSuperAdmin(req)
      ? { ...visibilityMatch }
      : {
          ...visibilityMatch,
          $or: [{ assignedTo: req.user._id }, { createdBy: req.user._id }],
        };

    // ✅ NEW: engagement filtering via $elemMatch
    const { elemMatch, error: engagementFilterErr } = buildEngagementElemMatch(req);
    if (engagementFilterErr) {
      return res.status(400).json({ message: engagementFilterErr });
    }

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
          origin: 1,
          leadId: 1,
          assignedTo: 1,
          createdBy: 1,
          createdAt: 1,
          updatedAt: 1,

          // optional: if you want to show engagements summary in list
          // engagements: 1,
        },
      },

      { $unset: "crmTasks" },

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
    const nextCursor = customers.length
      ? String(customers[customers.length - 1]._id)
      : null;

    return res.status(200).json({
      count: customers.length,
      hasMore,
      nextCursor,
      customers,
    });
  } catch (err) {
    return res.status(500).json({
      message: "Server error in getCustomers.",
      error: err.message,
    });
  }
};

/**
 * GET SINGLE CUSTOMER (DETAILS)
 * GET /customers/:id
 *
 * ✅ Returns customer details (excluding crmTasks)
 * ✅ Includes: customerFiles + engagements (with title + sub texts)
 */
export const getCustomerById = async (req, res) => {
  try {
    const customerId = toObjectIdOrNull(req.params.id);
    if (!customerId)
      return res.status(400).json({ message: "Invalid customer id." });

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
      { $unset: "crmTasks" },

      // ✅ join engagement templates
      {
        $lookup: {
          from: "engagementtemplates",
          localField: "engagements.engagementTemplateId",
          foreignField: "_id",
          as: "engagementTemplateDocs",
        },
      },

      // ✅ map engagements to include title + selected subEngagement texts
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
    if (!rows.length)
      return res.status(404).json({ message: "Customer not found." });

    return res.status(200).json({ customer: rows[0] });
  } catch (err) {
    return res.status(500).json({
      message: "Server error in getCustomerById.",
      error: err.message,
    });
  }
};

/**
 * GET CUSTOMER TASKS (PAGINATED + PRIVACY)
 * GET /customers/:id/tasks?limit=20&cursor=<taskId>
 */
export const getCustomerTasks = async (req, res) => {
  try {
    const customerId = toObjectIdOrNull(req.params.id);
    if (!customerId)
      return res.status(400).json({ message: "Invalid customer id." });

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

      ...(isAdminOrSuperAdmin(req)
        ? []
        : [{ $match: { "crmTasks.assignedTo": meId } }]),

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

    return res.status(200).json({
      count: tasks.length,
      hasMore,
      nextCursor,
      tasks,
    });
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
 *
 * Updatable fields:
 * - customerType
 * - customerFiles (replace full list) [optional]
 */
export const updateCustomer = async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id).select(
      "name companyName email phone address contactPerson status createdBy origin leadId customerType customerFiles"
    );

    if (!customer)
      return res.status(404).json({ message: "Customer not found." });

    const isOwner =
      String(customer.createdBy?._id ?? customer.createdBy) ===
      String(req.user._id);

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

    if (req.body.address !== undefined) {
      customer.address = String(req.body.address || "").trim();
    }

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

    if (req.body.status !== undefined)
      customer.status = normalizeStatus(req.body.status);

    if (req.body.customerType !== undefined) {
      customer.customerType = normalizeCustomerType(req.body.customerType);
    }

    if (req.body.customerFiles !== undefined) {
      const { files, error } = normalizeCustomerFiles(req.body.customerFiles, req.user._id);
      if (error) return res.status(400).json({ message: error });
      customer.customerFiles = files;
    }

    await customer.save();

    return res.status(200).json({ message: "Customer updated.", customer });
  } catch (err) {
    return res.status(500).json({
      message: "Server error in updateCustomer.",
      error: err.message,
    });
  }
};

/**
 * UPSERT CUSTOMER ENGAGEMENT (by year)
 * PATCH /customers/:id/engagements
 * body: { year, engagementTemplateId, subEngagementIds?: [] }
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
    if (!engagementTemplateId) {
      return res.status(400).json({ message: "engagementTemplateId is required." });
    }

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

    // keep engagements sorted newest year first (optional)
    customer.engagements.sort((a, b) => Number(b.year) - Number(a.year));

    await customer.save();

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
    if (!isAdminOrSuperAdmin(req)) {
      return res.status(403).json({ message: "Not authorized." });
    }

    const customer = await Customer.findByIdAndDelete(req.params.id).select("_id");
    if (!customer)
      return res.status(404).json({ message: "Customer not found." });

    return res.status(200).json({ message: "Customer deleted." });
  } catch (err) {
    return res.status(500).json({
      message: "Server error in deleteCustomer.",
      error: err.message,
    });
  }
};

/**
 * ASSIGN / REASSIGN CUSTOMER (admin/superadmin only)
 * PATCH /customers/:id/assign
 * body: { employeeId } OR { employeeIds: [] }
 */
export const assignCustomer = async (req, res) => {
  try {
    if (!isAdminOrSuperAdmin(req)) {
      return res.status(403).json({ message: "Not authorized." });
    }

    const { employeeId, employeeIds } = req.body;
    let ids = [];

    if (employeeIds !== undefined) {
      if (!Array.isArray(employeeIds)) {
        return res.status(400).json({ message: "employeeIds must be an array." });
      }
      ids = employeeIds.filter(Boolean).map(String);
    } else if (employeeId) {
      ids = [String(employeeId)];
    } else {
      return res.status(400).json({
        message: "Provide employeeId (single) or employeeIds (multiple).",
      });
    }

    if (ids.length > 0) {
      const employees = await User.find({
        _id: { $in: ids },
        role: "employee",
      }).select("_id");

      if (employees.length !== ids.length) {
        return res.status(404).json({ message: "One or more employees not found." });
      }
    }

    const updated = await Customer.findByIdAndUpdate(
      req.params.id,
      { $set: { assignedTo: ids } },
      { new: true }
    ).select("name assignedTo createdBy status origin customerType createdAt");

    if (!updated) return res.status(404).json({ message: "Customer not found." });

    return res.status(200).json({
      message: "Customer assigned successfully.",
      customer: updated,
    });
  } catch (err) {
    return res.status(500).json({
      message: "Server error in assignCustomer.",
      error: err.message,
    });
  }
};
