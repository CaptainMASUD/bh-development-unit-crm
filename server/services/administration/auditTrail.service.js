import mongoose from "mongoose";
import AuditLog from "../../models/auditLog.model.js";

export async function getAuditTrailStats({ tenantId }) {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [totalEvents, todayEvents, activeModules, activeActors] = await Promise.all([
    AuditLog.countDocuments({ tenantId }),
    AuditLog.countDocuments({ tenantId, createdAt: { $gte: startOfToday } }),
    AuditLog.distinct("module", { tenantId }),
    AuditLog.distinct("actorName", { tenantId }),
  ]);

  return {
    totalEvents,
    todayEvents,
    moduleCount: (activeModules || []).filter(Boolean).length,
    actorCount: (activeActors || []).filter(Boolean).length,
  };
}

export async function listAuditTrail({
  tenantId,
  page = 1,
  limit = 25,
  module,
  action,
  actorId,
  entityType,
  startDate,
  endDate,
  search,
}) {
  if (!tenantId) {
    throw Object.assign(new Error("A verified tenant is required."), { statusCode: 403 });
  }

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 25));
  const skip = (pageNum - 1) * limitNum;

  const query = { tenantId };

  if (module && String(module).trim()) {
    query.module = String(module).trim().toLowerCase();
  }

  if (action && String(action).trim()) {
    query.action = String(action).trim();
  }

  if (actorId && mongoose.isValidObjectId(actorId)) {
    query.actorId = new mongoose.Types.ObjectId(actorId);
  }

  if (entityType && String(entityType).trim()) {
    query.entityType = String(entityType).trim();
  }

  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) {
      const start = new Date(startDate);
      if (!isNaN(start.getTime())) {
        query.createdAt.$gte = start;
      }
    }
    if (endDate) {
      const end = new Date(endDate);
      if (!isNaN(end.getTime())) {
        // If only a date string like '2026-09-22' is passed without time, set to end of day
        if (typeof endDate === "string" && !endDate.includes("T")) {
          end.setHours(23, 59, 59, 999);
        }
        query.createdAt.$lte = end;
      }
    }
    if (Object.keys(query.createdAt).length === 0) {
      delete query.createdAt;
    }
  }

  if (search && String(search).trim()) {
    const escaped = String(search).trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const searchRegex = new RegExp(escaped, "i");
    query.$or = [
      { recordIdentifier: searchRegex },
      { actorName: searchRegex },
      { actorEmail: searchRegex },
      { entityType: searchRegex },
      { action: searchRegex },
      { module: searchRegex },
    ];
  }

  const [total, items, stats] = await Promise.all([
    AuditLog.countDocuments(query),
    AuditLog.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean(),
    getAuditTrailStats({ tenantId }),
  ]);

  const pages = Math.ceil(total / limitNum) || 1;

  return {
    items,
    pagination: {
      total,
      page: pageNum,
      limit: limitNum,
      pages,
    },
    stats,
  };
}

export async function getAuditTrailDetail({ tenantId, id }) {
  if (!tenantId) {
    throw Object.assign(new Error("A verified tenant is required."), { statusCode: 403 });
  }

  if (!id || !mongoose.isValidObjectId(id)) {
    throw Object.assign(new Error("Invalid audit log ID."), { statusCode: 400 });
  }

  const log = await AuditLog.findOne({ _id: id, tenantId }).lean();
  if (!log) {
    throw Object.assign(new Error("Audit log entry not found."), { statusCode: 404 });
  }

  return log;
}

export async function getAuditTrailFilterOptions({ tenantId }) {
  if (!tenantId) {
    throw Object.assign(new Error("A verified tenant is required."), { statusCode: 403 });
  }

  const [modules, actions, entityTypes, actorDocs] = await Promise.all([
    AuditLog.distinct("module", { tenantId }),
    AuditLog.distinct("action", { tenantId }),
    AuditLog.distinct("entityType", { tenantId }),
    AuditLog.aggregate([
      { $match: { tenantId: new mongoose.Types.ObjectId(tenantId) } },
      {
        $group: {
          _id: "$actorId",
          name: { $first: "$actorName" },
          email: { $first: "$actorEmail" },
          role: { $first: "$actorRole" },
        },
      },
      { $match: { _id: { $ne: null } } },
      { $sort: { name: 1 } },
      { $limit: 100 },
    ]),
  ]);

  return {
    modules: (modules || []).filter(Boolean).sort(),
    actions: (actions || []).filter(Boolean).sort(),
    entityTypes: (entityTypes || []).filter(Boolean).sort(),
    actors: (actorDocs || []).map((a) => ({
      _id: a._id,
      name: a.name || "Unknown",
      email: a.email || "",
      role: a.role || "",
    })),
  };
}
