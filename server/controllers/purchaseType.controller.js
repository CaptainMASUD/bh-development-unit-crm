// controllers/purchaseType.controller.js
import PurchaseType from "../models/purchaseType.model.js";

export const listPurchaseTypes = async (req, res) => {
  try {
    const items = await PurchaseType.find({ isActive: true })
      .select({ name: 1, key: 1 })
      .sort({ name: 1 })
      .lean();

    return res.json({ items });
  } catch (err) {
    return res.status(500).json({ message: "Failed to list purchase types", error: err.message });
  }
};

export const createPurchaseType = async (req, res) => {
  try {
    const name = String(req.body?.name || "").trim();
    if (!name) return res.status(400).json({ message: "name is required" });

    const key = String(req.body?.key || name)
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-");

    const doc = await PurchaseType.create({
      name,
      key,
      createdBy: req.user._id,
    });

    return res.status(201).json({ message: "Purchase type created", purchaseType: doc });
  } catch (err) {
    // duplicate key
    if (err.code === 11000) {
      return res.status(409).json({ message: "Purchase type already exists" });
    }
    return res.status(500).json({ message: "Failed to create purchase type", error: err.message });
  }
};
