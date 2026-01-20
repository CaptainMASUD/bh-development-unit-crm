// controllers/product.controller.js
import mongoose from "mongoose";
import Product from "../models/product.model.js";

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

/* =========================================================
   CREATE PRODUCT (admin)
   POST /products
   body: { name, sku?, price?, currency?, active?, description? }
========================================================= */
export const createProduct = async (req, res) => {
  try {
    if (!isAdminOrSuperAdmin(req)) {
      return res.status(403).json({ message: "Only admin can create products." });
    }

    const name = String(req.body?.name ?? "").trim();
    if (!name) return res.status(400).json({ message: "name is required." });

    const sku = req.body?.sku ? String(req.body.sku).trim() : "";
    const description = req.body?.description ? String(req.body.description).trim() : "";

    const price = req.body?.price !== undefined ? Number(req.body.price) : 0;
    const safePrice = Number.isFinite(price) && price >= 0 ? price : 0;

    const currency = String(req.body?.currency ?? "BDT").trim();
    const active = req.body?.active !== undefined ? Boolean(req.body.active) : true;

    const exists = await Product.exists({
      $or: [{ name }, ...(sku ? [{ sku }] : [])],
    });
    if (exists) return res.status(409).json({ message: "Product with same name/sku already exists." });

    const product = await Product.create({
      name,
      sku,
      description,
      price: safePrice,
      currency,
      active,
      createdBy: req.user?._id ?? null,
    });

    return res.status(201).json({ message: "Product created.", product });
  } catch (err) {
    return res.status(500).json({ message: "Server error in createProduct.", error: err.message });
  }
};

/* =========================================================
   LIST / SEARCH PRODUCTS
   GET /products?q=&active=&limit=&cursor=
========================================================= */
export const getProducts = async (req, res) => {
  try {
    const limit = clampInt(req.query.limit, 1, 100, 20);
    const cursor = toObjectIdSafe(req.query.cursor);

    const filter = {};

    // filter active (optional)
    if (req.query.active !== undefined) {
      const a = String(req.query.active).toLowerCase();
      if (a === "true" || a === "1") filter.active = true;
      else if (a === "false" || a === "0") filter.active = false;
    }

    // search query (optional)
    const q = req.query.q ? String(req.query.q).trim() : "";
    if (q) {
      filter.$or = [
        { name: { $regex: q, $options: "i" } },
        { sku: { $regex: q, $options: "i" } },
      ];
    }

    if (cursor) filter._id = { $lt: cursor };

    const rows = await Product.find(filter)
      .sort({ _id: -1 })
      .limit(limit + 1)
      .lean();

    const hasMore = rows.length > limit;
    const products = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore ? String(products[products.length - 1]._id) : null;

    return res.status(200).json({ count: products.length, hasMore, nextCursor, products });
  } catch (err) {
    return res.status(500).json({ message: "Server error in getProducts.", error: err.message });
  }
};

/* =========================================================
   ✅ GET SINGLE PRODUCT (FIXES YOUR ERROR)
   GET /products/:id
========================================================= */
export const getProductById = async (req, res) => {
  try {
    const id = toObjectIdSafe(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid product id." });

    const product = await Product.findById(id).lean();
    if (!product) return res.status(404).json({ message: "Product not found." });

    return res.status(200).json({ product });
  } catch (err) {
    return res.status(500).json({ message: "Server error in getProductById.", error: err.message });
  }
};

/* =========================================================
   UPDATE PRODUCT (admin)
   PATCH /products/:id
========================================================= */
export const updateProduct = async (req, res) => {
  try {
    if (!isAdminOrSuperAdmin(req)) {
      return res.status(403).json({ message: "Only admin can update products." });
    }

    const id = toObjectIdSafe(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid product id." });

    const product = await Product.findById(id);
    if (!product) return res.status(404).json({ message: "Product not found." });

    if (req.body.name !== undefined) {
      const name = String(req.body.name ?? "").trim();
      if (!name) return res.status(400).json({ message: "name cannot be empty." });
      product.name = name;
    }

    if (req.body.sku !== undefined) {
      product.sku = String(req.body.sku ?? "").trim();
    }

    if (req.body.description !== undefined) {
      product.description = String(req.body.description ?? "").trim();
    }

    if (req.body.price !== undefined) {
      const price = Number(req.body.price);
      product.price = Number.isFinite(price) && price >= 0 ? price : 0;
    }

    if (req.body.currency !== undefined) {
      product.currency = String(req.body.currency ?? "BDT").trim();
    }

    if (req.body.active !== undefined) {
      product.active = Boolean(req.body.active);
    }

    await product.save();
    return res.status(200).json({ message: "Product updated.", product });
  } catch (err) {
    return res.status(500).json({ message: "Server error in updateProduct.", error: err.message });
  }
};

/* =========================================================
   TOGGLE ACTIVE (admin)
   PATCH /products/:id/active
========================================================= */
export const toggleProductActive = async (req, res) => {
  try {
    if (!isAdminOrSuperAdmin(req)) {
      return res.status(403).json({ message: "Only admin can toggle product." });
    }

    const id = toObjectIdSafe(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid product id." });

    const product = await Product.findById(id);
    if (!product) return res.status(404).json({ message: "Product not found." });

    product.active = !Boolean(product.active);
    await product.save();

    return res.status(200).json({ message: "Product active toggled.", product });
  } catch (err) {
    return res.status(500).json({ message: "Server error in toggleProductActive.", error: err.message });
  }
};

/* =========================================================
   DELETE PRODUCT (admin)
   DELETE /products/:id
========================================================= */
export const deleteProduct = async (req, res) => {
  try {
    if (!isAdminOrSuperAdmin(req)) {
      return res.status(403).json({ message: "Only admin can delete products." });
    }

    const id = toObjectIdSafe(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid product id." });

    const r = await Product.deleteOne({ _id: id });
    if (r.deletedCount === 0) return res.status(404).json({ message: "Product not found." });

    return res.status(200).json({ message: "Product deleted." });
  } catch (err) {
    return res.status(500).json({ message: "Server error in deleteProduct.", error: err.message });
  }
};
