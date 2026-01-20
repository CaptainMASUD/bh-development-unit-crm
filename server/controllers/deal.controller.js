// controllers/deal.controller.js
import mongoose from "mongoose";
import Deal from "../models/deal.model.js";
import Customer from "../models/customer.model.js";
import Lead from "../models/lead.model.js";

const { Types } = mongoose;

const isAdminOrSuperAdmin = (req) =>
  req.user?.role === "admin" || req.user?.role === "superadmin";

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

const STAGES = ["new", "qualified", "proposal", "negotiation", "won", "lost"];

const canAccessCustomer = (customerDoc, user) => {
  if (!customerDoc || !user) return false;
  if (user.role === "admin" || user.role === "superadmin") return true;

  const uid = String(user._id);
  const createdBy = String(customerDoc.createdBy?._id ?? customerDoc.createdBy ?? "");
  const assigned = Array.isArray(customerDoc.assignedTo) ? customerDoc.assignedTo : [];
  const assignedIds = assigned.map((x) => String(x?._id ?? x));
  return createdBy === uid || assignedIds.includes(uid);
};

const normalizeItems = (items) => {
  if (items === undefined) return { items: undefined };
  if (!Array.isArray(items)) return { error: "items must be an array." };
  if (items.length > 500) return { error: "Too many items (max 500)." };

  const out = [];
  for (const it of items) {
    if (!it || typeof it !== "object") continue;

    const name = String(it.name ?? "").trim();
    const qty = Number(it.qty ?? 0);
    const unitPrice = Number(it.unitPrice ?? 0);
    const discount = Number(it.discount ?? 0);

    if (!name) continue;
    if (!Number.isFinite(qty) || qty <= 0) continue;
    if (!Number.isFinite(unitPrice) || unitPrice < 0) continue;
    if (!Number.isFinite(discount) || discount < 0) continue;

    out.push({
      productId:
        it.productId && Types.ObjectId.isValid(it.productId)
          ? new Types.ObjectId(String(it.productId))
          : null,
      name,
      qty,
      unitPrice,
      discount,
      note: it.note ? String(it.note).trim() : "",
    });
  }

  return { items: out };
};

const calcTotals = (items) => {
  const subTotal = (items || []).reduce((s, it) => s + it.qty * it.unitPrice, 0);
  const discountTotal = (items || []).reduce((s, it) => s + (it.discount || 0), 0);
  const total = Math.max(0, subTotal - discountTotal);
  return { subTotal, discountTotal, total };
};

const getDealWithCustomer = async (dealId) => {
  return Deal.findById(dealId)
    .populate("customerId", "_id createdBy assignedTo name companyName origin status")
    .populate("ownerId", "name email role")
    .lean();
};

/* =========================
   CREATE DEAL
   POST /deals
========================= */
export const createDeal = async (req, res) => {
  try {
    const customerId = toObjectIdSafe(req.body.customerId);
    if (!customerId) return res.status(400).json({ message: "customerId is required." });

    const customer = await Customer.findById(customerId)
      .select("_id createdBy assignedTo name companyName")
      .lean();
    if (!customer) return res.status(404).json({ message: "Customer not found." });

    if (!canAccessCustomer(customer, req.user)) {
      return res.status(403).json({ message: "No access to this customer." });
    }

    const title = String(req.body.title ?? "").trim();
    if (!title) return res.status(400).json({ message: "title is required." });

    const stage = String(req.body.stage ?? "new").toLowerCase();
    if (!STAGES.includes(stage)) return res.status(400).json({ message: "Invalid stage." });

    const expectedCloseAt = req.body.expectedCloseAt ? new Date(req.body.expectedCloseAt) : null;
    if (expectedCloseAt && Number.isNaN(expectedCloseAt.getTime())) {
      return res.status(400).json({ message: "Invalid expectedCloseAt." });
    }

    const probability = req.body.probability !== undefined ? Number(req.body.probability) : undefined;
    if (probability !== undefined && (!Number.isFinite(probability) || probability < 0 || probability > 100)) {
      return res.status(400).json({ message: "probability must be 0..100." });
    }

    const { items, error: itemsErr } = normalizeItems(req.body.items);
    if (itemsErr) return res.status(400).json({ message: itemsErr });

    const totals = calcTotals(items || []);

    const ownerId =
      req.body.ownerId && Types.ObjectId.isValid(req.body.ownerId)
        ? new Types.ObjectId(String(req.body.ownerId))
        : req.user._id;

    const leadId = toObjectIdSafe(req.body.leadId);

    if (leadId) {
      const lead = await Lead.findById(leadId).select("_id").lean();
      if (!lead) return res.status(404).json({ message: "Lead not found." });
    }

    const now = new Date();

    const deal = await Deal.create({
      customerId,
      leadId: leadId ?? null,
      title,
      stage,
      probability: probability ?? 0,
      expectedCloseAt,
      ownerId,
      items: items ?? [],
      totals,
      wonAt: stage === "won" ? now : null,
      lostAt: stage === "lost" ? now : null,
      lostReason: stage === "lost" ? String(req.body.lostReason ?? "").trim() : "",
      createdBy: req.user._id,
    });

    return res.status(201).json({ message: "Deal created.", deal });
  } catch (err) {
    return res.status(500).json({ message: "Server error in createDeal.", error: err.message });
  }
};

/* =========================
   LIST DEALS
   GET /deals
========================= */
export const getDeals = async (req, res) => {
  try {
    const limit = clampInt(req.query.limit, 1, 100, 20);
    const cursor = toObjectIdSafe(req.query.cursor);

    const filter = {};

    const customerId = toObjectIdSafe(req.query.customerId);
    if (customerId) filter.customerId = customerId;

    const stage = req.query.stage ? String(req.query.stage).toLowerCase() : null;
    if (stage) {
      if (!STAGES.includes(stage)) return res.status(400).json({ message: "Invalid stage filter." });
      filter.stage = stage;
    }

    const ownerId = toObjectIdSafe(req.query.ownerId);
    if (ownerId) filter.ownerId = ownerId;

    if (cursor) filter._id = { $lt: cursor };

    let rows = await Deal.find(filter)
      .sort({ _id: -1 })
      .limit(limit + 1)
      .populate("customerId", "name companyName createdBy assignedTo origin status")
      .populate("ownerId", "name email role")
      .lean();

    if (!isAdminOrSuperAdmin(req)) {
      rows = rows.filter((d) => canAccessCustomer(d.customerId, req.user));
    }

    const hasMore = rows.length > limit;
    const deals = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore ? String(deals[deals.length - 1]._id) : null;

    return res.status(200).json({ count: deals.length, hasMore, nextCursor, deals });
  } catch (err) {
    return res.status(500).json({ message: "Server error in getDeals.", error: err.message });
  }
};

/* =========================
   GET SINGLE DEAL
   GET /deals/:id
========================= */
export const getDealById = async (req, res) => {
  try {
    const id = toObjectIdSafe(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid deal id." });

    const deal = await getDealWithCustomer(id);

    if (!deal) return res.status(404).json({ message: "Deal not found." });
    if (!canAccessCustomer(deal.customerId, req.user)) return res.status(403).json({ message: "No access." });

    return res.status(200).json({ deal });
  } catch (err) {
    return res.status(500).json({ message: "Server error in getDealById.", error: err.message });
  }
};

/* =========================
   UPDATE DEAL (general)
   PATCH /deals/:id
========================= */
export const updateDeal = async (req, res) => {
  try {
    const id = toObjectIdSafe(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid deal id." });

    const existing = await getDealWithCustomer(id);
    if (!existing) return res.status(404).json({ message: "Deal not found." });
    if (!canAccessCustomer(existing.customerId, req.user)) return res.status(403).json({ message: "No access." });

    const $set = {};

    if (req.body.title !== undefined) {
      const t = String(req.body.title ?? "").trim();
      if (!t) return res.status(400).json({ message: "title cannot be empty." });
      $set.title = t;
    }

    if (req.body.expectedCloseAt !== undefined) {
      const d = req.body.expectedCloseAt ? new Date(req.body.expectedCloseAt) : null;
      if (d && Number.isNaN(d.getTime())) return res.status(400).json({ message: "Invalid expectedCloseAt." });
      $set.expectedCloseAt = d;
    }

    if (req.body.probability !== undefined) {
      const p = Number(req.body.probability);
      if (!Number.isFinite(p) || p < 0 || p > 100) {
        return res.status(400).json({ message: "probability must be 0..100." });
      }
      $set.probability = p;
    }

    if (req.body.stage !== undefined) {
      const stage = String(req.body.stage).toLowerCase();
      if (!STAGES.includes(stage)) return res.status(400).json({ message: "Invalid stage." });
      $set.stage = stage;
      const now = new Date();

      if (stage === "won") {
        $set.wonAt = now;
        $set.lostAt = null;
        $set.lostReason = "";
      } else if (stage === "lost") {
        $set.lostAt = now;
        $set.wonAt = null;
        $set.lostReason = String(req.body.lostReason ?? "").trim();
      } else {
        $set.wonAt = null;
        $set.lostAt = null;
        if (req.body.lostReason !== undefined) $set.lostReason = "";
      }
    }

    if (req.body.lostReason !== undefined && req.body.stage === undefined) {
      $set.lostReason = String(req.body.lostReason ?? "").trim();
    }

    if (Object.keys($set).length === 0) {
      return res.status(200).json({ message: "No changes." });
    }

    await Deal.updateOne({ _id: id }, { $set });

    const updated = await Deal.findById(id).lean();
    return res.status(200).json({ message: "Deal updated.", deal: updated });
  } catch (err) {
    return res.status(500).json({ message: "Server error in updateDeal.", error: err.message });
  }
};

/* =========================================================
   ✅ MISSING EXPORT #1
   UPDATE DEAL STAGE ONLY
   PATCH /deals/:id/stage
   body: { stage, lostReason?, probability? }
========================================================= */
export const updateDealStage = async (req, res) => {
  try {
    const id = toObjectIdSafe(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid deal id." });

    const existing = await getDealWithCustomer(id);
    if (!existing) return res.status(404).json({ message: "Deal not found." });
    if (!canAccessCustomer(existing.customerId, req.user)) return res.status(403).json({ message: "No access." });

    const stage = String(req.body.stage ?? "").toLowerCase();
    if (!STAGES.includes(stage)) return res.status(400).json({ message: "Invalid stage." });

    const $set = { stage };
    const now = new Date();

    // optional probability update here too
    if (req.body.probability !== undefined) {
      const p = Number(req.body.probability);
      if (!Number.isFinite(p) || p < 0 || p > 100) {
        return res.status(400).json({ message: "probability must be 0..100." });
      }
      $set.probability = p;
    }

    if (stage === "won") {
      $set.wonAt = now;
      $set.lostAt = null;
      $set.lostReason = "";
    } else if (stage === "lost") {
      $set.lostAt = now;
      $set.wonAt = null;
      $set.lostReason = String(req.body.lostReason ?? "").trim();
    } else {
      $set.wonAt = null;
      $set.lostAt = null;
      $set.lostReason = "";
    }

    await Deal.updateOne({ _id: id }, { $set });

    const updated = await Deal.findById(id).lean();
    return res.status(200).json({ message: "Deal stage updated.", deal: updated });
  } catch (err) {
    return res.status(500).json({ message: "Server error in updateDealStage.", error: err.message });
  }
};

/* =========================================================
   ✅ MISSING EXPORT #2
   UPSERT DEAL ITEMS ONLY
   PATCH /deals/:id/items
   body: { items: [...] }
========================================================= */
export const upsertDealItems = async (req, res) => {
  try {
    const id = toObjectIdSafe(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid deal id." });

    const existing = await getDealWithCustomer(id);
    if (!existing) return res.status(404).json({ message: "Deal not found." });
    if (!canAccessCustomer(existing.customerId, req.user)) return res.status(403).json({ message: "No access." });

    const { items, error: itemsErr } = normalizeItems(req.body.items);
    if (itemsErr) return res.status(400).json({ message: itemsErr });

    const totals = calcTotals(items || []);

    await Deal.updateOne(
      { _id: id },
      {
        $set: {
          items: items || [],
          totals,
        },
      }
    );

    const updated = await Deal.findById(id).lean();
    return res.status(200).json({ message: "Deal items updated.", deal: updated });
  } catch (err) {
    return res.status(500).json({ message: "Server error in upsertDealItems.", error: err.message });
  }
};

/* =========================================================
   CLOSE DEAL
   POST /deals/:id/close
   body: { result: "won" | "lost", lostReason? }
========================================================= */
export const closeDeal = async (req, res) => {
  try {
    const id = toObjectIdSafe(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid deal id." });

    const existing = await getDealWithCustomer(id);
    if (!existing) return res.status(404).json({ message: "Deal not found." });
    if (!canAccessCustomer(existing.customerId, req.user)) return res.status(403).json({ message: "No access." });

    const result = String(req.body.result || "").toLowerCase();
    if (result !== "won" && result !== "lost") {
      return res.status(400).json({ message: "result must be 'won' or 'lost'." });
    }

    const now = new Date();

    const $set = {
      stage: result,
      wonAt: result === "won" ? now : null,
      lostAt: result === "lost" ? now : null,
      lostReason: result === "lost" ? String(req.body.lostReason ?? "").trim() : "",
    };

    await Deal.updateOne({ _id: id }, { $set });

    const updated = await Deal.findById(id).lean();
    return res.status(200).json({ message: `Deal ${result}.`, deal: updated });
  } catch (err) {
    return res.status(500).json({ message: "Server error in closeDeal.", error: err.message });
  }
};

/* =========================
   DELETE DEAL (admin only)
   DELETE /deals/:id
========================= */
export const deleteDeal = async (req, res) => {
  try {
    if (!isAdminOrSuperAdmin(req)) return res.status(403).json({ message: "Only admin can delete deals." });

    const id = toObjectIdSafe(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid deal id." });

    const r = await Deal.deleteOne({ _id: id });
    if (r.deletedCount === 0) return res.status(404).json({ message: "Deal not found." });

    return res.status(200).json({ message: "Deal deleted." });
  } catch (err) {
    return res.status(500).json({ message: "Server error in deleteDeal.", error: err.message });
  }
};
