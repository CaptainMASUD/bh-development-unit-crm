import mongoose from "mongoose";
import ServiceLog from "../models/serviceLog.model.js";

const toObjectIdSafe = (id) => {
  try {
    if (!id) return null;
    if (mongoose.Types.ObjectId.isValid(id)) return new mongoose.Types.ObjectId(String(id));
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

/**
 * GET /reports/services/customer/:customerId/history?serviceId=&from=&to=&limit=50&cursor=
 */
export const getCustomerServiceHistory = async (req, res) => {
  try {
    const customerId = toObjectIdSafe(req.params.customerId);
    if (!customerId) return res.status(400).json({ message: "Invalid customerId." });

    const serviceId = req.query.serviceId ? toObjectIdSafe(req.query.serviceId) : null;
    if (req.query.serviceId && !serviceId) return res.status(400).json({ message: "Invalid serviceId." });

    const limit = clampInt(req.query.limit, 1, 200, 50);
    const cursor = req.query.cursor ? toObjectIdSafe(req.query.cursor) : null;

    const from = req.query.from ? new Date(req.query.from) : null;
    const to = req.query.to ? new Date(req.query.to) : null;

    const match = { customerId };
    if (serviceId) match.serviceId = serviceId;
    if (from || to) {
      match.completedAt = {};
      if (from) match.completedAt.$gte = from;
      if (to) match.completedAt.$lte = to;
    }
    if (cursor) match._id = { $lt: cursor };

    const rows = await ServiceLog.find(match).sort({ _id: -1 }).limit(limit + 1).lean();

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore ? String(items[items.length - 1]._id) : null;

    const stats = await ServiceLog.aggregate([
      { $match: { customerId, ...(serviceId ? { serviceId } : {}) } },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          avgDuration: { $avg: "$durationMinutes" },
          totalDuration: { $sum: "$durationMinutes" },
          lastCompletedAt: { $max: "$completedAt" },
        },
      },
    ]);

    const summary = stats?.[0]
      ? {
          count: stats[0].count,
          avgDurationMinutes: Math.round(stats[0].avgDuration || 0),
          totalDurationMinutes: stats[0].totalDuration || 0,
          lastCompletedAt: stats[0].lastCompletedAt || null,
        }
      : { count: 0, avgDurationMinutes: 0, totalDurationMinutes: 0, lastCompletedAt: null };

    return res.status(200).json({
      message: "Customer service history fetched.",
      summary,
      items,
      hasMore,
      nextCursor,
      count: items.length,
    });
  } catch (err) {
    return res.status(500).json({ message: "Server error in getCustomerServiceHistory.", error: err.message });
  }
};

/**
 * GET /reports/services/customer/:customerId/summary?from=&to=
 */
export const getCustomerServiceSummary = async (req, res) => {
  try {
    const customerId = toObjectIdSafe(req.params.customerId);
    if (!customerId) return res.status(400).json({ message: "Invalid customerId." });

    const from = req.query.from ? new Date(req.query.from) : null;
    const to = req.query.to ? new Date(req.query.to) : null;

    const match = { customerId };
    if (from || to) {
      match.completedAt = {};
      if (from) match.completedAt.$gte = from;
      if (to) match.completedAt.$lte = to;
    }

    const rows = await ServiceLog.aggregate([
      { $match: match },
      {
        $group: {
          _id: { serviceId: "$serviceId", title: "$serviceTitleSnapshot" },
          count: { $sum: 1 },
          avgDuration: { $avg: "$durationMinutes" },
          totalDuration: { $sum: "$durationMinutes" },
          lastCompletedAt: { $max: "$completedAt" },
        },
      },
      { $sort: { count: -1, lastCompletedAt: -1 } },
      {
        $project: {
          _id: 0,
          serviceId: "$_id.serviceId",
          title: "$_id.title",
          count: 1,
          avgDurationMinutes: { $round: ["$avgDuration", 0] },
          totalDurationMinutes: 1,
          lastCompletedAt: 1,
        },
      },
    ]);

    return res.status(200).json({ message: "Customer service summary fetched.", rows, count: rows.length });
  } catch (err) {
    return res.status(500).json({ message: "Server error in getCustomerServiceSummary.", error: err.message });
  }
};

/**
 * GET /reports/services/global/summary?from=&to=&serviceId=
 */
export const getGlobalServiceSummary = async (req, res) => {
  try {
    const serviceId = req.query.serviceId ? toObjectIdSafe(req.query.serviceId) : null;
    if (req.query.serviceId && !serviceId) return res.status(400).json({ message: "Invalid serviceId." });

    const from = req.query.from ? new Date(req.query.from) : null;
    const to = req.query.to ? new Date(req.query.to) : null;

    const match = {};
    if (serviceId) match.serviceId = serviceId;
    if (from || to) {
      match.completedAt = {};
      if (from) match.completedAt.$gte = from;
      if (to) match.completedAt.$lte = to;
    }

    const rows = await ServiceLog.aggregate([
      { $match: match },
      {
        $group: {
          _id: { serviceId: "$serviceId", title: "$serviceTitleSnapshot" },
          count: { $sum: 1 },
          avgDuration: { $avg: "$durationMinutes" },
          lastCompletedAt: { $max: "$completedAt" },
        },
      },
      { $sort: { count: -1, lastCompletedAt: -1 } },
      {
        $project: {
          _id: 0,
          serviceId: "$_id.serviceId",
          title: "$_id.title",
          count: 1,
          avgDurationMinutes: { $round: ["$avgDuration", 0] },
          lastCompletedAt: 1,
        },
      },
    ]);

    return res.status(200).json({ message: "Global service summary fetched.", rows, count: rows.length });
  } catch (err) {
    return res.status(500).json({ message: "Server error in getGlobalServiceSummary.", error: err.message });
  }
};
