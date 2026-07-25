import mongoose from "mongoose";
import Product from "../../models/inventory/product.model.js";
import ProductCategory, { CATEGORY_STATUSES } from "../../models/inventory/productCategory.model.js";

const LIST_FIELDS = [
  "name",
  "code",
  "slug",
  "parent",
  "description",
  "imageUrl",
  "sortOrder",
  "status",
  "updatedAt",
].join(" ");

const OPTION_FIELDS = "name code slug parent sortOrder status";

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

const nullableId = (value) => {
  const normalized = clean(value);
  if (!normalized) return null;
  return isId(normalized) ? normalized : undefined;
};

const slugify = (value) =>
  clean(value)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 180);

const encodeCursor = (category) => {
  const payload = JSON.stringify({
    s: Number(category.sortOrder || 0),
    n: String(category.nameLower || category.name || "").toLowerCase(),
    id: String(category._id),
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

const buildCategoryPayload = (body = {}, userId = null) => {
  const payload = {};

  for (const field of ["name", "code", "slug", "description", "imageUrl"]) {
    if (body[field] !== undefined) payload[field] = clean(body[field]);
  }

  if (body.parent !== undefined) payload.parent = nullableId(body.parent);
  if (body.sortOrder !== undefined) payload.sortOrder = parseSortOrder(body.sortOrder);
  if (body.status !== undefined) payload.status = clean(body.status).toLowerCase();
  if (userId) payload.updatedBy = userId;

  return payload;
};

const validatePayload = (payload, { partial = false } = {}) => {
  const errors = [];

  if ((!partial || payload.name !== undefined) && !clean(payload.name)) {
    errors.push("Category name is required.");
  }
  if ((!partial || payload.code !== undefined) && !clean(payload.code)) {
    errors.push("Category code is required.");
  }
  if (Object.prototype.hasOwnProperty.call(payload, "parent") && payload.parent === undefined) {
    errors.push("Parent category must be a valid ID or empty.");
  }
  if (payload.sortOrder !== undefined && (!Number.isInteger(payload.sortOrder) || payload.sortOrder < 0 || payload.sortOrder > 1000000)) {
    errors.push("Sort order must be an integer between 0 and 1000000.");
  }
  if (payload.status !== undefined && !CATEGORY_STATUSES.includes(payload.status)) {
    errors.push("Category status has an invalid value.");
  }
  if (payload.status === "archived") {
    errors.push("Use the category archive endpoint to archive a category.");
  }

  return errors;
};

const validateParentCategory = async (parentId, { requireActive = false } = {}) => {
  if (!parentId) return null;

  const parent = await ProductCategory.findById(parentId)
    .select("name code parent status")
    .maxTimeMS(3000)
    .lean();

  if (!parent) {
    throw Object.assign(new Error("Parent category was not found."), { statusCode: 404 });
  }
  if (parent.status === "archived") {
    throw Object.assign(new Error("An archived category cannot be used as a parent."), { statusCode: 409 });
  }
  if (requireActive && parent.status !== "active") {
    throw Object.assign(new Error("An active category must have an active parent category."), { statusCode: 409 });
  }

  return parent;
};

const assertNoCategoryCycle = async (categoryId, parentId) => {
  if (!parentId) return;
  if (String(categoryId) === String(parentId)) {
    throw Object.assign(new Error("A category cannot be its own parent."), { statusCode: 400 });
  }

  const result = await ProductCategory.aggregate([
    { $match: { _id: new mongoose.Types.ObjectId(parentId) } },
    {
      $graphLookup: {
        from: ProductCategory.collection.name,
        startWith: "$parent",
        connectFromField: "parent",
        connectToField: "_id",
        as: "ancestors",
        maxDepth: 30,
      },
    },
    {
      $project: {
        ancestorIds: "$ancestors._id",
      },
    },
  ]).option({ maxTimeMS: 3000 });

  const ancestorIds = result[0]?.ancestorIds || [];
  if (ancestorIds.some((id) => String(id) === String(categoryId))) {
    throw Object.assign(new Error("The selected parent would create a category hierarchy cycle."), { statusCode: 409 });
  }
};

const duplicateMessage = (error) => {
  const fields = Object.keys(error?.keyPattern || error?.keyValue || {});
  if (fields.includes("code")) return "A category with this code already exists.";
  if (fields.includes("slug")) return "A category with this slug already exists.";
  if (fields.includes("parent") && fields.includes("nameLower")) {
    return "A category with this name already exists under the selected parent.";
  }
  return "A category with the same unique value already exists.";
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

  if (query.parent === "root" || query.parent === "null") {
    filter.parent = null;
  } else if (isId(query.parent)) {
    filter.parent = query.parent;
  }

  const q = clean(query.q);
  if (q) {
    const normalizedName = q.toLowerCase();
    const normalizedCode = q.toUpperCase();
    const normalizedSlug = q.toLowerCase();

    filter.$or = [
      { nameLower: new RegExp(`^${escapeRegex(normalizedName)}`) },
      { code: new RegExp(`^${escapeRegex(normalizedCode)}`) },
      { slug: new RegExp(`^${escapeRegex(normalizedSlug)}`) },
    ];
  }

  return filter;
};

export const listProductCategories = async (req, res) => {
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

    const categories = await ProductCategory.find(filter)
      .select(`${LIST_FIELDS} +nameLower`)
      .sort({ sortOrder: 1, nameLower: 1, _id: 1 })
      .limit(limit + 1)
      .maxTimeMS(5000)
      .lean();

    const hasMore = categories.length > limit;
    if (hasMore) categories.pop();

    const nextCursor = hasMore && categories.length ? encodeCursor(categories[categories.length - 1]) : null;
    const data = categories.map(({ nameLower, ...category }) => category);

    return res.json({ count: data.length, hasMore, nextCursor, categories: data });
  } catch (error) {
    return res.status(500).json({ message: "Failed to load product categories.", error: error.message });
  }
};

export const listProductCategoryOptions = async (req, res) => {
  try {
    const limit = parseLimit(req.query.limit, 50, 200);
    const filter = { status: "active" };

    if (isId(req.query.exclude)) filter._id = { $ne: req.query.exclude };
    if (req.query.parent === "root" || req.query.parent === "null") filter.parent = null;
    else if (isId(req.query.parent)) filter.parent = req.query.parent;

    const q = clean(req.query.q);
    if (q) {
      const normalizedName = q.toLowerCase();
      const normalizedCode = q.toUpperCase();
      filter.$or = [
        { nameLower: new RegExp(`^${escapeRegex(normalizedName)}`) },
        { code: new RegExp(`^${escapeRegex(normalizedCode)}`) },
      ];
    }

    const categories = await ProductCategory.find(filter)
      .select(OPTION_FIELDS)
      .sort({ sortOrder: 1, nameLower: 1, _id: 1 })
      .limit(limit)
      .maxTimeMS(3000)
      .lean();

    return res.json({ count: categories.length, categories });
  } catch (error) {
    return res.status(500).json({ message: "Failed to load category options.", error: error.message });
  }
};

export const getProductCategoryTree = async (req, res) => {
  try {
    const filter = {};
    if (req.query.status && req.query.status !== "all") {
      filter.status = clean(req.query.status).toLowerCase();
    } else {
      filter.status = { $in: ["active", "inactive"] };
    }

    const categories = await ProductCategory.find(filter)
      .select(OPTION_FIELDS)
      .sort({ sortOrder: 1, nameLower: 1, _id: 1 })
      .limit(2000)
      .maxTimeMS(5000)
      .lean();

    const nodes = new Map(
      categories.map((category) => [String(category._id), { ...category, children: [] }])
    );
    const roots = [];

    for (const category of nodes.values()) {
      const parentId = category.parent ? String(category.parent) : null;
      if (parentId && nodes.has(parentId)) nodes.get(parentId).children.push(category);
      else roots.push(category);
    }

    return res.json({ count: categories.length, categories: roots });
  } catch (error) {
    return res.status(500).json({ message: "Failed to load category tree.", error: error.message });
  }
};

export const getProductCategory = async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(400).json({ message: "Invalid category ID." });

    const category = await ProductCategory.findById(req.params.id)
      .select("-nameLower")
      .populate("parent", "name code slug status")
      .maxTimeMS(3000)
      .lean();

    if (!category) return res.status(404).json({ message: "Product category not found." });
    return res.json({ category });
  } catch (error) {
    return res.status(500).json({ message: "Failed to load product category.", error: error.message });
  }
};

export const lookupProductCategory = async (req, res) => {
  try {
    const value = clean(req.params.value);
    if (!value) return res.status(400).json({ message: "Category code or slug is required." });

    const category = await ProductCategory.findOne({
      status: { $ne: "archived" },
      $or: [{ code: value.toUpperCase() }, { slug: value.toLowerCase() }],
    })
      .select(LIST_FIELDS)
      .maxTimeMS(3000)
      .lean();

    if (!category) return res.status(404).json({ message: "Product category not found." });
    return res.json({ category });
  } catch (error) {
    return res.status(500).json({ message: "Failed to find product category.", error: error.message });
  }
};

export const createProductCategory = async (req, res) => {
  try {
    const userId = req.user?._id || null;
    const payload = buildCategoryPayload(req.body, userId);
    const errors = validatePayload(payload);

    if (errors.length) return res.status(400).json({ message: errors[0], errors });

    payload.code = clean(payload.code).toUpperCase();
    payload.slug = slugify(payload.slug || `${payload.name}-${payload.code}`);
    if (!payload.slug) return res.status(400).json({ message: "A valid category slug could not be generated." });

    await validateParentCategory(payload.parent, { requireActive: (payload.status || "active") === "active" });

    const category = await ProductCategory.create({
      ...payload,
      createdBy: userId,
      updatedBy: userId,
    });

    return res.status(201).json({ message: "Product category created.", category });
  } catch (error) {
    return sendWriteError(res, error, "Failed to create product category.");
  }
};

export const updateProductCategory = async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(400).json({ message: "Invalid category ID." });

    const payload = buildCategoryPayload(req.body, req.user?._id || null);
    const editableKeys = Object.keys(payload).filter((key) => key !== "updatedBy");
    if (!editableKeys.length) return res.status(400).json({ message: "No valid category fields were provided." });

    const errors = validatePayload(payload, { partial: true });
    if (errors.length) return res.status(400).json({ message: errors[0], errors });

    const current = await ProductCategory.findById(req.params.id)
      .select("name code slug parent status")
      .maxTimeMS(3000)
      .lean();

    if (!current) return res.status(404).json({ message: "Product category not found." });
    if (current.status === "archived") {
      return res.status(409).json({ message: "Restore the archived category before editing it." });
    }

    if (payload.code !== undefined) payload.code = clean(payload.code).toUpperCase();
    if (payload.slug !== undefined) {
      payload.slug = slugify(payload.slug);
      if (!payload.slug) return res.status(400).json({ message: "Category slug is invalid." });
    }

    const nextParent = payload.parent !== undefined ? payload.parent : current.parent;
    const nextStatus = payload.status !== undefined ? payload.status : current.status;

    await validateParentCategory(nextParent, { requireActive: nextStatus === "active" });
    if (payload.parent !== undefined && String(payload.parent || "") !== String(current.parent || "")) {
      await assertNoCategoryCycle(req.params.id, payload.parent);
    }

    const category = await ProductCategory.findByIdAndUpdate(req.params.id, payload, {
      new: true,
      runValidators: true,
      context: "query",
    }).select("-nameLower");

    return res.json({ message: "Product category updated.", category });
  } catch (error) {
    return sendWriteError(res, error, "Failed to update product category.");
  }
};

export const updateProductCategoryStatus = async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(400).json({ message: "Invalid category ID." });

    const status = clean(req.body.status).toLowerCase();
    if (!["active", "inactive"].includes(status)) {
      return res.status(400).json({ message: "Status must be active or inactive." });
    }

    const current = await ProductCategory.findById(req.params.id)
      .select("parent status")
      .maxTimeMS(3000)
      .lean();

    if (!current || current.status === "archived") {
      return res.status(404).json({ message: "Product category not found or archived." });
    }

    if (status === "active") {
      await validateParentCategory(current.parent, { requireActive: true });
    }

    if (status === "inactive") {
      const activeChild = await ProductCategory.exists({ parent: req.params.id, status: "active" });
      if (activeChild) {
        return res.status(409).json({ message: "Deactivate child categories before deactivating this category." });
      }
    }

    const category = await ProductCategory.findByIdAndUpdate(
      req.params.id,
      { status, archivedAt: null, updatedBy: req.user?._id || null },
      { new: true, runValidators: true }
    ).select(LIST_FIELDS);

    return res.json({ message: "Product category status updated.", category });
  } catch (error) {
    return sendWriteError(res, error, "Failed to update product category status.");
  }
};

export const deleteProductCategory = async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(400).json({ message: "Invalid category ID." });

    const category = await ProductCategory.findById(req.params.id)
      .select("name code status")
      .maxTimeMS(3000)
      .lean();

    if (!category || category.status === "archived") {
      return res.status(404).json({ message: "Product category not found or already archived." });
    }

    const [hasChildren, hasProducts] = await Promise.all([
      ProductCategory.exists({ parent: req.params.id, status: { $ne: "archived" } }),
      Product.exists({ category: req.params.id, status: { $ne: "archived" } }),
    ]);

    if (hasChildren) {
      return res.status(409).json({ message: "Move or archive child categories before archiving this category." });
    }
    if (hasProducts) {
      return res.status(409).json({ message: "Move or archive products assigned to this category first." });
    }

    const archived = await ProductCategory.findByIdAndUpdate(
      req.params.id,
      { status: "archived", archivedAt: new Date(), updatedBy: req.user?._id || null },
      { new: true, runValidators: true }
    ).select("name code status archivedAt");

    return res.json({ message: "Product category archived.", category: archived });
  } catch (error) {
    return sendWriteError(res, error, "Failed to archive product category.");
  }
};

export const restoreProductCategory = async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(400).json({ message: "Invalid category ID." });

    const current = await ProductCategory.findOne({ _id: req.params.id, status: "archived" })
      .select("parent")
      .maxTimeMS(3000)
      .lean();

    if (!current) return res.status(404).json({ message: "Archived product category not found." });
    await validateParentCategory(current.parent, { requireActive: false });

    const category = await ProductCategory.findByIdAndUpdate(
      req.params.id,
      { status: "inactive", archivedAt: null, updatedBy: req.user?._id || null },
      { new: true, runValidators: true }
    ).select(LIST_FIELDS);

    return res.json({ message: "Product category restored as inactive.", category });
  } catch (error) {
    return sendWriteError(res, error, "Failed to restore product category.");
  }
};
