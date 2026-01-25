import express from "express";
import mongoose from "mongoose";
import { protect } from "../middleware/auth.middleware.js";
import ActivityLog from "../models/activityLog.model.js";

const router = express.Router();
router.use(protect);

const toObjectId = (v) =>
  mongoose.Types.ObjectId.isValid(v) ? new mongoose.Types.ObjectId(String(v)) : null;

/**
 * GET /activity?leadId=&customerId=&limit=50&cursor=<activityId>
 */
router.get("/", async (req, res) => {
  try {
    const leadId = toObjectId(req.query.leadId);
    const customerId = toObjectId(req.query.customerId);
    const limit = Math.max(1, Math.min(100, Number(req.query.limit || 50)));
    const cursor = toObjectId(req.query.cursor);

    const filter = {};
    if (leadId) filter.leadId = leadId;
    if (customerId) filter.customerId = customerId;
    if (!leadId && !customerId) return res.status(400).json({ message: "leadId or customerId required" });

    if (cursor) filter._id = { $lt: cursor };

    const rows = await ActivityLog.find(filter).sort({ _id: -1 }).limit(limit + 1).lean();
    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore ? String(items[items.length - 1]._id) : null;

    res.json({ items, pageInfo: { limit, hasMore, nextCursor } });
  } catch (err) {
    res.status(500).json({ message: "Failed to load activity", error: err.message });
  }
});

export default router;
