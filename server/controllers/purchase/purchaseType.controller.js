// controllers/purchaseType.controller.js
import mongoose from "mongoose";
import PurchaseType from "../../models/purchaseType.model.js";

const makeKey = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");

const escapeRegex = (s) => String(s || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const encodeCursor = (obj) => Buffer.from(JSON.stringify(obj), "utf8").toString("base64");

const decodeCursor = (str) => {
  try {
    return JSON.parse(Buffer.from(String(str), "base64").toString("utf8"));
  } catch {
    return null;
  }
};

const clampInt = (v, { min, max, fallback }) => {
  const n = Number.parseInt(v, 10);
  if (Number.isNaN(n)) return fallback;
  return Math.min(max, Math.max(min, n));
};

const parseBoolStrict = (v) => {
  if (typeof v === "boolean") return v;
  const s = String(v ?? "").trim().toLowerCase();
  if (["true", "1", "yes", "y"].includes(s)) return true;
  if (["false", "0", "no", "n"].includes(s)) return false;
  return undefined;
};

// GET /api/purchase-types?q=&active=true|false|all&limit=20&cursor=...
export const listPurchaseTypes = async (req, res) => {
  try {
    const qRaw = String(req.query?.q || "").trim();
    const q = qRaw.toLowerCase();
    const activeParam = String(req.query?.active || "true").toLowerCase();
    const limit = clampInt(req.query?.limit, { min: 1, max: 100, fallback: 20 });

    const cursorObj = req.query?.cursor ? decodeCursor(req.query.cursor) : null;

    const baseFilter = {};
    if (activeParam === "true") baseFilter.isActive = true;
    else if (activeParam === "false") baseFilter.isActive = false;

    const andParts = [];

    if (q) {
      const rx = new RegExp(`^${escapeRegex(q)}`, "i");
      andParts.push({ $or: [{ nameLower: rx }, { key: rx }] });
    }

    if (cursorObj?.nameLower && cursorObj?.id && mongoose.Types.ObjectId.isValid(cursorObj.id)) {
      const lastNameLower = String(cursorObj.nameLower);
      const lastId = new mongoose.Types.ObjectId(cursorObj.id);

      andParts.push({
        $or: [
          { nameLower: { $gt: lastNameLower } },
          { nameLower: lastNameLower, _id: { $gt: lastId } },
        ],
      });
    }

    const filter =
      andParts.length > 0 ? { ...baseFilter, $and: andParts } : { ...baseFilter };

    const docs = await PurchaseType.find(filter)
      .select({ name: 1, key: 1, isActive: 1, createdAt: 1, updatedAt: 1, nameLower: 1 })
      .sort({ nameLower: 1, _id: 1 })
      .limit(limit + 1)
      .lean();

    const hasNextPage = docs.length > limit;
    const items = hasNextPage ? docs.slice(0, limit) : docs;

    let nextCursor = null;
    if (hasNextPage && items.length) {
      const last = items[items.length - 1];
      nextCursor = encodeCursor({ nameLower: last.nameLower, id: String(last._id) });
    }

    for (const it of items) delete it.nameLower;

    return res.json({ items, pageInfo: { nextCursor, hasNextPage } });
  } catch (err) {
    return res.status(500).json({ message: "Failed to list purchase types", error: err.message });
  }
};

// POST /api/purchase-types
export const createPurchaseType = async (req, res) => {
  try {
    const name = String(req.body?.name || "").trim();
    if (!name) return res.status(400).json({ message: "name is required" });

    const key = makeKey(req.body?.key || name);
    if (!key) return res.status(400).json({ message: "key is required" });

    const doc = await PurchaseType.create({
      name,
      key,
      createdBy: req.user._id,
    });

    return res.status(201).json({
      message: "Purchase type created",
      purchaseType: {
        _id: doc._id,
        name: doc.name,
        key: doc.key,
        isActive: doc.isActive,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
      },
    });
  } catch (err) {
    if (err?.code === 11000) return res.status(409).json({ message: "Purchase type already exists" });
    return res.status(500).json({ message: "Failed to create purchase type", error: err.message });
  }
};

// PATCH /api/purchase-types/:id
export const updatePurchaseType = async (req, res) => {
  try {
    const id = String(req.params?.id || "").trim();
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ message: "Invalid id" });

    const updates = {};

    if (req.body?.name !== undefined) {
      const name = String(req.body.name || "").trim();
      if (!name) return res.status(400).json({ message: "name cannot be empty" });
      updates.name = name;
      updates.nameLower = name.toLowerCase();
    }

    if (req.body?.key !== undefined) {
      const key = makeKey(req.body.key);
      if (!key) return res.status(400).json({ message: "key cannot be empty" });
      updates.key = key;
    }

    if (req.body?.isActive !== undefined) {
      const b = parseBoolStrict(req.body.isActive);
      if (b === undefined) return res.status(400).json({ message: "isActive must be boolean" });
      updates.isActive = b;
    }

    if (!Object.keys(updates).length) {
      return res.status(400).json({ message: "No valid fields to update" });
    }

    const doc = await PurchaseType.findOneAndUpdate(
      { _id: id },
      { $set: updates },
      { new: true, runValidators: true }
    )
      .select({ name: 1, key: 1, isActive: 1, createdAt: 1, updatedAt: 1 })
      .lean();

    if (!doc) return res.status(404).json({ message: "Purchase type not found" });

    return res.json({ message: "Purchase type updated", purchaseType: doc });
  } catch (err) {
    if (err?.code === 11000) return res.status(409).json({ message: "Purchase type key already exists" });
    return res.status(500).json({ message: "Failed to update purchase type", error: err.message });
  }
};

// DELETE /api/purchase-types/:id
export const deletePurchaseType = async (req, res) => {
  try {
    const id = String(req.params?.id || "").trim();
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ message: "Invalid id" });

    const doc = await PurchaseType.findOneAndUpdate(
      { _id: id },
      { $set: { isActive: false } },
      { new: true }
    )
      .select({ name: 1, key: 1, isActive: 1, createdAt: 1, updatedAt: 1 })
      .lean();

    if (!doc) return res.status(404).json({ message: "Purchase type not found" });

    return res.json({ message: "Purchase type deleted", purchaseType: doc });
  } catch (err) {
    return res.status(500).json({ message: "Failed to delete purchase type", error: err.message });
  }
};
