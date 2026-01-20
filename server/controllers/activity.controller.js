// controllers/activity.controller.js
import mongoose from "mongoose";
import Activity from "../models/activity.model.js";
import Customer from "../models/customer.model.js";
import Lead from "../models/lead.model.js";
import Deal from "../models/deal.model.js";

const { Types } = mongoose;

const isAdminOrSuperAdmin = (req) =>
  req.user?.role === "admin" || req.user?.role === "superadmin";

const isMarketing = (req) => req.user?.role === "marketing_team";

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
  return Math.max(min, Math.min(max, Math.trunc(v)));
};

const canAccessCustomer = (customerDoc, user) => {
  if (!customerDoc || !user) return false;
  if (user.role === "admin" || user.role === "superadmin") return true;

  const uid = String(user._id);
  const createdBy = String(customerDoc.createdBy?._id ?? customerDoc.createdBy ?? "");
  const assigned = Array.isArray(customerDoc.assignedTo) ? customerDoc.assignedTo : [];
  const assignedIds = assigned.map((x) => String(x?._id ?? x));

  return createdBy === uid || assignedIds.includes(uid);
};

const activityTypes = ["call", "email", "meeting", "note", "whatsapp", "task_followup", "other"];

const assertCanAccessLead = async (req, leadId) => {
  if (!leadId) return { ok: true };

  const lead = await Lead.findById(leadId).select("_id assignedTo").lean();
  if (!lead) return { ok: false, code: 404, message: "Lead not found." };

  if (isAdminOrSuperAdmin(req)) return { ok: true };

  if (isMarketing(req)) {
    if (String(lead.assignedTo) !== String(req.user._id)) {
      return { ok: false, code: 403, message: "No access to this lead." };
    }
    return { ok: true };
  }

  return { ok: false, code: 403, message: "Not allowed for this role." };
};

const assertCanAccessDeal = async (req, dealId) => {
  if (!dealId) return { ok: true };

  const deal = await Deal.findById(dealId).select("_id customerId").lean();
  if (!deal) return { ok: false, code: 404, message: "Deal not found." };

  const cust = await Customer.findById(deal.customerId).select("_id createdBy assignedTo").lean();
  if (!cust) return { ok: false, code: 404, message: "Customer not found for deal." };

  if (!canAccessCustomer(cust, req.user)) return { ok: false, code: 403, message: "No access." };
  return { ok: true, customerId: cust._id };
};

const assertCanAccessCustomerId = async (req, customerId) => {
  if (!customerId) return { ok: true };

  const cust = await Customer.findById(customerId).select("_id createdBy assignedTo").lean();
  if (!cust) return { ok: false, code: 404, message: "Customer not found." };

  if (!canAccessCustomer(cust, req.user)) return { ok: false, code: 403, message: "No access." };
  return { ok: true, customerId: cust._id };
};

const canModifyActivity = (req, activity) => {
  if (isAdminOrSuperAdmin(req)) return true;
  return String(activity.createdBy) === String(req.user._id);
};

/* =========================================================
   CREATE ACTIVITY
   POST /activities
========================================================= */
export const createActivity = async (req, res) => {
  try {
    const type = String(req.body?.type ?? "note").trim().toLowerCase();
    const text = String(req.body?.text ?? "").trim();

    if (!activityTypes.includes(type)) {
      return res.status(400).json({ message: "Invalid activity type." });
    }
    if (!text) return res.status(400).json({ message: "text is required." });

    const customerId = toObjectIdSafe(req.body?.customerId);
    const leadId = toObjectIdSafe(req.body?.leadId);
    const dealId = toObjectIdSafe(req.body?.dealId);

    if (!customerId && !leadId && !dealId) {
      return res.status(400).json({ message: "Provide customerId or leadId or dealId." });
    }

    let resolvedCustomerId = null;

    const dealCheck = await assertCanAccessDeal(req, dealId);
    if (!dealCheck.ok) return res.status(dealCheck.code).json({ message: dealCheck.message });
    if (dealCheck.customerId) resolvedCustomerId = dealCheck.customerId;

    const custCheck = await assertCanAccessCustomerId(req, customerId);
    if (!custCheck.ok) return res.status(custCheck.code).json({ message: custCheck.message });
    if (custCheck.customerId) resolvedCustomerId = custCheck.customerId;

    const leadCheck = await assertCanAccessLead(req, leadId);
    if (leadId && !leadCheck.ok) return res.status(leadCheck.code).json({ message: leadCheck.message });

    const scheduledAt = req.body?.scheduledAt ? new Date(req.body.scheduledAt) : null;
    if (scheduledAt && Number.isNaN(scheduledAt.getTime())) {
      return res.status(400).json({ message: "Invalid scheduledAt." });
    }

    const doc = await Activity.create({
      type,
      text,
      outcome: req.body?.outcome ? String(req.body.outcome).trim() : "",
      customerId: customerId ?? resolvedCustomerId ?? null,
      leadId: leadId ?? null,
      dealId: dealId ?? null,
      scheduledAt,
      isDone: false,
      doneAt: null,
      createdBy: req.user._id,
    });

    return res.status(201).json({ message: "Activity created.", activity: doc });
  } catch (err) {
    return res.status(500).json({ message: "Server error in createActivity.", error: err.message });
  }
};

/* =========================================================
   LIST ACTIVITIES
   GET /activities?customerId=&leadId=&dealId=&type=&limit=&cursor=
========================================================= */
export const getActivities = async (req, res) => {
  try {
    const limit = clampInt(req.query.limit, 1, 100, 20);
    const cursor = toObjectIdSafe(req.query.cursor);

    const customerId = toObjectIdSafe(req.query.customerId);
    const leadId = toObjectIdSafe(req.query.leadId);
    const dealId = toObjectIdSafe(req.query.dealId);

    const type = req.query.type ? String(req.query.type).trim().toLowerCase() : null;
    if (type && !activityTypes.includes(type)) {
      return res.status(400).json({ message: "Invalid type filter." });
    }

    if (!customerId && !leadId && !dealId) {
      return res.status(400).json({ message: "Provide customerId or leadId or dealId." });
    }

    const dealCheck = await assertCanAccessDeal(req, dealId);
    if (!dealCheck.ok) return res.status(dealCheck.code).json({ message: dealCheck.message });

    const custCheck = await assertCanAccessCustomerId(req, customerId);
    if (!custCheck.ok) return res.status(custCheck.code).json({ message: custCheck.message });

    const leadCheck = await assertCanAccessLead(req, leadId);
    if (leadId && !leadCheck.ok) return res.status(leadCheck.code).json({ message: leadCheck.message });

    const filter = {};
    if (customerId) filter.customerId = customerId;
    if (leadId) filter.leadId = leadId;
    if (dealId) filter.dealId = dealId;
    if (type) filter.type = type;
    if (cursor) filter._id = { $lt: cursor };

    const rows = await Activity.find(filter)
      .sort({ _id: -1 })
      .limit(limit + 1)
      .populate("createdBy", "name email role")
      .lean();

    const hasMore = rows.length > limit;
    const activities = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore ? String(activities[activities.length - 1]._id) : null;

    return res.status(200).json({ count: activities.length, hasMore, nextCursor, activities });
  } catch (err) {
    return res.status(500).json({ message: "Server error in getActivities.", error: err.message });
  }
};

/* =========================================================
   GET SINGLE ACTIVITY
   GET /activities/:id
========================================================= */
export const getActivityById = async (req, res) => {
  try {
    const id = toObjectIdSafe(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid id." });

    const act = await Activity.findById(id).populate("createdBy", "name email role").lean();
    if (!act) return res.status(404).json({ message: "Activity not found." });

    if (act.dealId) {
      const dealCheck = await assertCanAccessDeal(req, act.dealId);
      if (!dealCheck.ok) return res.status(dealCheck.code).json({ message: dealCheck.message });
    }
    if (act.customerId) {
      const custCheck = await assertCanAccessCustomerId(req, act.customerId);
      if (!custCheck.ok) return res.status(custCheck.code).json({ message: custCheck.message });
    }
    if (act.leadId) {
      const leadCheck = await assertCanAccessLead(req, act.leadId);
      if (!leadCheck.ok) return res.status(leadCheck.code).json({ message: leadCheck.message });
    }

    return res.status(200).json({ activity: act });
  } catch (err) {
    return res.status(500).json({ message: "Server error in getActivityById.", error: err.message });
  }
};

/* =========================================================
   UPDATE ACTIVITY
   PATCH /activities/:id
========================================================= */
export const updateActivity = async (req, res) => {
  try {
    const id = toObjectIdSafe(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid id." });

    const act = await Activity.findById(id);
    if (!act) return res.status(404).json({ message: "Activity not found." });

    if (act.dealId) {
      const dealCheck = await assertCanAccessDeal(req, act.dealId);
      if (!dealCheck.ok) return res.status(dealCheck.code).json({ message: dealCheck.message });
    }
    if (act.customerId) {
      const custCheck = await assertCanAccessCustomerId(req, act.customerId);
      if (!custCheck.ok) return res.status(custCheck.code).json({ message: custCheck.message });
    }
    if (act.leadId) {
      const leadCheck = await assertCanAccessLead(req, act.leadId);
      if (!leadCheck.ok) return res.status(leadCheck.code).json({ message: leadCheck.message });
    }

    if (!canModifyActivity(req, act)) {
      return res.status(403).json({ message: "Not allowed." });
    }

    if (req.body.type !== undefined) {
      const type = String(req.body.type ?? "").trim().toLowerCase();
      if (!activityTypes.includes(type)) return res.status(400).json({ message: "Invalid activity type." });
      act.type = type;
    }

    if (req.body.text !== undefined) {
      const text = String(req.body.text ?? "").trim();
      if (!text) return res.status(400).json({ message: "text cannot be empty." });
      act.text = text;
    }

    if (req.body.outcome !== undefined) {
      act.outcome = String(req.body.outcome ?? "").trim();
    }

    if (req.body.scheduledAt !== undefined) {
      const d = req.body.scheduledAt ? new Date(req.body.scheduledAt) : null;
      if (d && Number.isNaN(d.getTime())) return res.status(400).json({ message: "Invalid scheduledAt." });
      act.scheduledAt = d;
    }

    if (req.body.isDone !== undefined) {
      const b = Boolean(req.body.isDone);
      act.isDone = b;
      act.doneAt = b ? new Date() : null;
    }

    await act.save();
    return res.status(200).json({ message: "Activity updated.", activity: act });
  } catch (err) {
    return res.status(500).json({ message: "Server error in updateActivity.", error: err.message });
  }
};

/* =========================================================
   MARK ACTIVITY DONE
   PATCH /activities/:id/done
========================================================= */
export const markActivityDone = async (req, res) => {
  try {
    const id = toObjectIdSafe(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid id." });

    const act = await Activity.findById(id);
    if (!act) return res.status(404).json({ message: "Activity not found." });

    if (!canModifyActivity(req, act)) {
      return res.status(403).json({ message: "Not allowed." });
    }

    act.isDone = true;
    act.doneAt = new Date();
    await act.save();

    return res.status(200).json({ message: "Activity marked done.", activity: act });
  } catch (err) {
    return res.status(500).json({ message: "Server error in markActivityDone.", error: err.message });
  }
};

/* =========================================================
   DELETE ACTIVITY
   DELETE /activities/:id
========================================================= */
export const deleteActivity = async (req, res) => {
  try {
    const id = toObjectIdSafe(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid id." });

    const act = await Activity.findById(id).lean();
    if (!act) return res.status(404).json({ message: "Activity not found." });

    if (act.dealId) {
      const dealCheck = await assertCanAccessDeal(req, act.dealId);
      if (!dealCheck.ok) return res.status(dealCheck.code).json({ message: dealCheck.message });
    }
    if (act.customerId) {
      const custCheck = await assertCanAccessCustomerId(req, act.customerId);
      if (!custCheck.ok) return res.status(custCheck.code).json({ message: custCheck.message });
    }
    if (act.leadId) {
      const leadCheck = await assertCanAccessLead(req, act.leadId);
      if (!leadCheck.ok) return res.status(leadCheck.code).json({ message: leadCheck.message });
    }

    if (!isAdminOrSuperAdmin(req) && String(act.createdBy) !== String(req.user._id)) {
      return res.status(403).json({ message: "Not allowed." });
    }

    await Activity.deleteOne({ _id: id });
    return res.status(200).json({ message: "Activity deleted." });
  } catch (err) {
    return res.status(500).json({ message: "Server error in deleteActivity.", error: err.message });
  }
};

/* =========================================================
   TIMELINE
   GET /activities/timeline?customerId=&leadId=&dealId=&limit=&cursor=
========================================================= */
export const getTimeline = async (req, res) => {
  try {
    const limit = clampInt(req.query.limit, 1, 100, 20);
    const cursor = toObjectIdSafe(req.query.cursor);

    const customerId = toObjectIdSafe(req.query.customerId);
    const leadId = toObjectIdSafe(req.query.leadId);
    const dealId = toObjectIdSafe(req.query.dealId);

    if (!customerId && !leadId && !dealId) {
      return res.status(400).json({ message: "Provide customerId or leadId or dealId." });
    }

    const dealCheck = await assertCanAccessDeal(req, dealId);
    if (!dealCheck.ok) return res.status(dealCheck.code).json({ message: dealCheck.message });

    const custCheck = await assertCanAccessCustomerId(req, customerId);
    if (!custCheck.ok) return res.status(custCheck.code).json({ message: custCheck.message });

    const leadCheck = await assertCanAccessLead(req, leadId);
    if (leadId && !leadCheck.ok) return res.status(leadCheck.code).json({ message: leadCheck.message });

    const filter = {};
    if (customerId) filter.customerId = customerId;
    if (leadId) filter.leadId = leadId;
    if (dealId) filter.dealId = dealId;
    if (cursor) filter._id = { $lt: cursor };

    const rows = await Activity.find(filter)
      .sort({ _id: -1 })
      .limit(limit + 1)
      .populate("createdBy", "name email role")
      .lean();

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore ? String(items[items.length - 1]._id) : null;

    return res.status(200).json({ count: items.length, hasMore, nextCursor, activities: items });
  } catch (err) {
    return res.status(500).json({ message: "Server error in getTimeline.", error: err.message });
  }
};

/* =========================================================
   UPCOMING FOLLOWUPS
   GET /activities/upcoming?days=7&limit=100
========================================================= */
export const getUpcomingFollowups = async (req, res) => {
  try {
    const days = clampInt(req.query.days, 1, 365, 7);
    const limit = clampInt(req.query.limit, 1, 500, 100);

    const now = new Date();
    const end = new Date(now.getTime() + days * 86400000);

    const filter = {
      scheduledAt: { $type: "date", $gte: now, $lte: end },
      isDone: false,
    };

    // simple scope for non-admin
    if (!isAdminOrSuperAdmin(req)) {
      filter.createdBy = req.user._id;
    }

    const rows = await Activity.find(filter)
      .sort({ scheduledAt: 1, _id: 1 })
      .limit(limit)
      .lean();

    return res.status(200).json({ count: rows.length, days, items: rows });
  } catch (err) {
    return res.status(500).json({ message: "Server error in getUpcomingFollowups.", error: err.message });
  }
};
