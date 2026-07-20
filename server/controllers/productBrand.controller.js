import mongoose from "mongoose";
import Product from "../models/product.model.js";
import ProductBrand, { BRAND_STATUSES } from "../models/productBrand.model.js";

const LIST_FIELDS = [
  "name",
  "code",
  "description",
  "logoUrl",
  "website",
  "country",
  "sortOrder",
  "status",
  "updatedAt",
].join(" ");

const OPTION_FIELDS = "name code logoUrl country sortOrder status";

const clean = (value) => String(value ?? "").trim();
const isId = (value) => mongoose.Types.ObjectId.isValid(String(value || ""));
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const parseLimit = (value, fallback = 30, max = 100) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.trunc(parsed), 1), max);
};

const parseSortOrder = (value) => {
  if (value === "" || value === null || value === undefined) return undefined;
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : Number.NaN;
};

const encodeCursor = (brand) => {
  const payload = JSON.stringify({
    s: Number(brand.sortOrder || 0),
    n: String(brand.nameLower || brand.name || "").toLowerCase(),
    id: String(brand._id),
  });
  return Buffer.from(payload, "utf8").toString("base64url");
};

const decodeCursor = (value) => {
  try {
    if (!value) return null;
    const parsed = JSON.parse(Buffer.from(String(value), "base64url").toString("utf8"));
    if (!Number.isInteger(parsed?.s) || typeof parsed?.n !== "string" || !isId(parsed?.id)) return null;
    return {
      sortOrder: parsed.s,
      nameLower: parsed.n,
      id: new mongoose.Types.ObjectId(parsed.id),
    };
  } catch {
    return null;
  }
};

const buildBrandPayload = (body = {}, userId = null) => {
  const payload = {};

  for (const field of ["name", "code", "description", "logoUrl", "website", "country"]) {
    if (body[field] !== undefined) payload[field] = clean(body[field]);
  }

  if (body.sortOrder !== undefined) payload.sortOrder = parseSortOrder(body.sortOrder);
  if (body.status !== undefined) payload.status = clean(body.status).toLowerCase();
  if (userId) payload.updatedBy = userId;

  return payload;
};

const validatePayload = (payload, { partial = false } = {}) => {
  const errors = [];

  if ((!partial || payload.name !== undefined) && !clean(payload.name)) {
    errors.push("Brand name is required.");
  }
  if ((!partial || payload.code !== undefined) && !clean(payload.code)) {
    errors.push("Brand code is required.");
  }
  if (
    payload.sortOrder !== undefined &&
    (!Number.isInteger(payload.sortOrder) || payload.sortOrder < 0 || payload.sortOrder > 1000000)
  ) {
    errors.push("Sort order must be an integer between 0 and 1000000.");
  }
  if (payload.status !== undefined && !BRAND_STATUSES.includes(payload.status)) {
    errors.push("Brand status has an invalid value.");
  }
  if (payload.status === "archived") {
    errors.push("Use the brand archive endpoint to archive a brand.");
  }

  return errors;
};

const duplicateMessage = (error) => {
  const fields = Object.keys(error?.keyPattern || error?.keyValue || {});
  if (fields.includes("code")) return "A brand with this code already exists.";
  if (fields.includes("nameLower")) return "A brand with this name already exists.";
  return "A brand with the same unique value already exists.";
};

const sendWriteError = (res, error, fallbackMessage) => {
  if (error?.code === 11000) {
    return res.status(409).json({ message: duplicateMessage(error), error: error.message });
  }
  if (error?.name === "ValidationError" || error?.name === "CastError") {
    return res.status(400).json({ message: error.message, error: error.message });
  }
  return res.status(error?.statusCode || 500).json({
    message: error?.statusCode ? error.message : fallbackMessage,
    error: error.message,
  });
};

const buildListFilter = (query = {}) => {
  const filter = {};

  if (query.status && query.status !== "all") {
    filter.status = clean(query.status).toLowerCase();
  } else {
    filter.status = { $in: ["active", "inactive"] };
  }

  if (query.country) filter.country = clean(query.country);

  const q = clean(query.q);
  if (q) {
    const normalizedName = q.toLowerCase();
    const normalizedCode = q.toUpperCase();
    filter.$or = [
      { nameLower: new RegExp(`^${escapeRegex(normalizedName)}`) },
      { code: new RegExp(`^${escapeRegex(normalizedCode)}`) },
    ];
  }

  return filter;
};

export const listProductBrands = async (req, res) => {
  try {
    const limit = parseLimit(req.query.limit, 30, 100);
    const cursor = decodeCursor(req.query.cursor);
    const filter = buildListFilter(req.query);

    if (req.query.cursor && !cursor) {
      return res.status(400).json({ message: "Invalid pagination cursor." });
    }

    if (cursor) {
      filter.$and = [
        ...(filter.$and || []),
        {
          $or: [
            { sortOrder: { $gt: cursor.sortOrder } },
            { sortOrder: cursor.sortOrder, nameLower: { $gt: cursor.nameLower } },
            { sortOrder: cursor.sortOrder, nameLower: cursor.nameLower, _id: { $gt: cursor.id } },
          ],
        },
      ];
    }

    const brands = await ProductBrand.find(filter)
      .select(`${LIST_FIELDS} +nameLower`)
      .sort({ sortOrder: 1, nameLower: 1, _id: 1 })
      .limit(limit + 1)
      .maxTimeMS(5000)
      .lean();

    const hasMore = brands.length > limit;
    if (hasMore) brands.pop();

    const nextCursor = hasMore && brands.length ? encodeCursor(brands[brands.length - 1]) : null;
    const data = brands.map(({ nameLower, ...brand }) => brand);

    return res.json({ count: data.length, hasMore, nextCursor, brands: data });
  } catch (error) {
    return res.status(500).json({ message: "Failed to load product brands.", error: error.message });
  }
};

export const listProductBrandOptions = async (req, res) => {
  try {
    const limit = parseLimit(req.query.limit, 50, 200);
    const filter = { status: "active" };

    if (req.query.country) filter.country = clean(req.query.country);

    const q = clean(req.query.q);
    if (q) {
      const normalizedName = q.toLowerCase();
      const normalizedCode = q.toUpperCase();
      filter.$or = [
        { nameLower: new RegExp(`^${escapeRegex(normalizedName)}`) },
        { code: new RegExp(`^${escapeRegex(normalizedCode)}`) },
      ];
    }

    const brands = await ProductBrand.find(filter)
      .select(OPTION_FIELDS)
      .sort({ sortOrder: 1, nameLower: 1, _id: 1 })
      .limit(limit)
      .maxTimeMS(3000)
      .lean();

    return res.json({ count: brands.length, brands });
  } catch (error) {
    return res.status(500).json({ message: "Failed to load brand options.", error: error.message });
  }
};

export const getProductBrand = async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(400).json({ message: "Invalid brand ID." });

    const brand = await ProductBrand.findById(req.params.id)
      .select("-nameLower")
      .maxTimeMS(3000)
      .lean();

    if (!brand) return res.status(404).json({ message: "Product brand not found." });
    return res.json({ brand });
  } catch (error) {
    return res.status(500).json({ message: "Failed to load product brand.", error: error.message });
  }
};

export const lookupProductBrand = async (req, res) => {
  try {
    const code = clean(req.params.code).toUpperCase();
    if (!code) return res.status(400).json({ message: "Brand code is required." });

    const brand = await ProductBrand.findOne({ code, status: { $ne: "archived" } })
      .select(LIST_FIELDS)
      .maxTimeMS(3000)
      .lean();

    if (!brand) return res.status(404).json({ message: "Product brand not found." });
    return res.json({ brand });
  } catch (error) {
    return res.status(500).json({ message: "Failed to find product brand.", error: error.message });
  }
};

export const createProductBrand = async (req, res) => {
  try {
    const userId = req.user?._id || null;
    const payload = buildBrandPayload(req.body, userId);
    const errors = validatePayload(payload);

    if (errors.length) return res.status(400).json({ message: errors[0], errors });

    const brand = await ProductBrand.create({
      ...payload,
      createdBy: userId,
      updatedBy: userId,
    });

    return res.status(201).json({ message: "Product brand created.", brand });
  } catch (error) {
    return sendWriteError(res, error, "Failed to create product brand.");
  }
};

export const updateProductBrand = async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(400).json({ message: "Invalid brand ID." });

    const payload = buildBrandPayload(req.body, req.user?._id || null);
    const editableKeys = Object.keys(payload).filter((key) => key !== "updatedBy");
    if (!editableKeys.length) return res.status(400).json({ message: "No valid brand fields were provided." });

    const errors = validatePayload(payload, { partial: true });
    if (errors.length) return res.status(400).json({ message: errors[0], errors });

    const current = await ProductBrand.findById(req.params.id)
      .select("status")
      .maxTimeMS(3000)
      .lean();

    if (!current) return res.status(404).json({ message: "Product brand not found." });
    if (current.status === "archived") {
      return res.status(409).json({ message: "Restore the archived brand before editing it." });
    }

    const brand = await ProductBrand.findByIdAndUpdate(req.params.id, payload, {
      new: true,
      runValidators: true,
      context: "query",
    }).select("-nameLower");

    return res.json({ message: "Product brand updated.", brand });
  } catch (error) {
    return sendWriteError(res, error, "Failed to update product brand.");
  }
};

export const updateProductBrandStatus = async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(400).json({ message: "Invalid brand ID." });

    const status = clean(req.body.status).toLowerCase();
    if (!["active", "inactive"].includes(status)) {
      return res.status(400).json({ message: "Status must be active or inactive." });
    }

    const brand = await ProductBrand.findOneAndUpdate(
      { _id: req.params.id, status: { $ne: "archived" } },
      { status, archivedAt: null, updatedBy: req.user?._id || null },
      { new: true, runValidators: true }
    ).select(LIST_FIELDS);

    if (!brand) return res.status(404).json({ message: "Product brand not found or archived." });
    return res.json({ message: "Product brand status updated.", brand });
  } catch (error) {
    return sendWriteError(res, error, "Failed to update product brand status.");
  }
};

export const deleteProductBrand = async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(400).json({ message: "Invalid brand ID." });

    const current = await ProductBrand.findById(req.params.id)
      .select("name code status")
      .maxTimeMS(3000)
      .lean();

    if (!current || current.status === "archived") {
      return res.status(404).json({ message: "Product brand not found or already archived." });
    }

    const hasProducts = await Product.exists({ brand: req.params.id, status: { $ne: "archived" } });
    if (hasProducts) {
      return res.status(409).json({ message: "Move or archive products assigned to this brand first." });
    }

    const brand = await ProductBrand.findByIdAndUpdate(
      req.params.id,
      { status: "archived", archivedAt: new Date(), updatedBy: req.user?._id || null },
      { new: true, runValidators: true }
    ).select("name code status archivedAt");

    return res.json({ message: "Product brand archived.", brand });
  } catch (error) {
    return sendWriteError(res, error, "Failed to archive product brand.");
  }
};

export const restoreProductBrand = async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(400).json({ message: "Invalid brand ID." });

    const brand = await ProductBrand.findOneAndUpdate(
      { _id: req.params.id, status: "archived" },
      { status: "inactive", archivedAt: null, updatedBy: req.user?._id || null },
      { new: true, runValidators: true }
    ).select(LIST_FIELDS);

    if (!brand) return res.status(404).json({ message: "Archived product brand not found." });
    return res.json({ message: "Product brand restored as inactive.", brand });
  } catch (error) {
    return sendWriteError(res, error, "Failed to restore product brand.");
  }
};
