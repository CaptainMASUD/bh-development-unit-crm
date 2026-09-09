import mongoose from "mongoose";
import Warehouse from "../../models/inventory/warehouse.model.js";
import WarehouseLocation, { LOCATION_STATUSES, LOCATION_TYPES } from "../../models/inventory/warehouseLocation.model.js";
import ProductStock from "../../models/inventory/productStock.model.js";
import { runMongoTransaction } from "../../utils/mongoTransaction.js";

const LIST_FIELDS = [
  "name",
  "code",
  "locationType",
  "parent",
  "ancestors",
  "depth",
  "sortOrder",
  "description",
  "barcode",
  "capacityQuantity",
  "isReceivable",
  "isPickable",
  "isDispatchable",
  "isQuarantine",
  "status",
  "updatedAt",
].join(" ");

const OPTION_FIELDS = "warehouse name code locationType parent ancestors depth sortOrder isReceivable isPickable isDispatchable isQuarantine status";

const clean = (value) => String(value ?? "").trim();
const isId = (value) => mongoose.Types.ObjectId.isValid(String(value || ""));
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const relationId = (value) => String(value?._id || value || "");

const hierarchyValue = (location, type) => {
  const nodes = [...(location.ancestors || []), location];
  const node = nodes.find((item) => item?.locationType === type);
  return clean(node?.code || node?.name) || "—";
};

export const attachWarehouseLocationStockDetails = (locations = [], stockRows = []) => {
  const byLocation = new Map();
  for (const stock of stockRows) {
    if (stock.status === "archived" || !relationId(stock.location)) continue;
    const key = relationId(stock.location);
    if (!byLocation.has(key)) byLocation.set(key, []);
    byLocation.get(key).push(stock);
  }

  return locations.map((location) => {
    const stocks = byLocation.get(relationId(location)) || [];
    const activeStocks = stocks.filter((stock) => stock.status !== "inactive" && stock.status !== "archived");
    const products = [...new Map(activeStocks.map((stock) => [relationId(stock.product), stock.product])).values()].filter(Boolean);
    const quantity = Math.round(activeStocks.reduce((sum, stock) => sum + Number(stock.onHandQuantity || 0), 0) * 1e6) / 1e6;
    const availableQuantity = activeStocks.reduce((sum, stock) => sum + Number(stock.availableQuantity || 0), 0);
    const insufficient = activeStocks.some((stock) => {
      const minimum = Number(stock.minimumStock ?? stock.product?.minimumStock ?? 0);
      return minimum > 0 && Number(stock.onHandQuantity || 0) <= minimum;
    });
    const availabilityStatus = location.status !== "active" || availableQuantity <= 0 ? "unavailable" : insufficient ? "insufficient" : "available";
    const currentProduct = products.length === 1
      ? { _id: products[0]._id, name: products[0].name, sku: products[0].sku || "" }
      : products.length > 1
        ? { _id: null, name: "Multiple Products", sku: "" }
        : null;

    return {
      ...location,
      zone: location.zone || hierarchyValue(location, "zone"),
      rack: location.rack || hierarchyValue(location, "rack"),
      shelf: location.shelf || hierarchyValue(location, "shelf"),
      quantity,
      currentProduct,
      productCount: products.length,
      availabilityStatus,
    };
  });
};

const parseLimit = (value, fallback = 40, max = 150) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.trunc(parsed), 1), max);
};

const parseBoolean = (value) => {
  if (value === true || value === "true") return true;
  if (value === false || value === "false") return false;
  return undefined;
};

const parseNumber = (value) => {
  if (value === "" || value === null || value === undefined) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
};

const nullableId = (value) => {
  const normalized = clean(value);
  if (!normalized) return null;
  return isId(normalized) ? normalized : undefined;
};

const encodeCursor = (location) =>
  Buffer.from(
    JSON.stringify({
      s: Number(location.sortOrder || 0),
      n: String(location.nameLower || location.name || "").toLowerCase(),
      id: String(location._id),
    }),
    "utf8"
  ).toString("base64url");

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

const buildLocationPayload = (body = {}, userId = null) => {
  const payload = {};

  for (const field of ["name", "code", "description", "barcode"]) {
    if (body[field] !== undefined) payload[field] = clean(body[field]);
  }

  if (body.warehouse !== undefined) payload.warehouse = nullableId(body.warehouse);
  if (body.parent !== undefined) payload.parent = nullableId(body.parent);
  if (body.locationType !== undefined) payload.locationType = clean(body.locationType).toLowerCase();
  if (body.status !== undefined) payload.status = clean(body.status).toLowerCase();
  if (body.sortOrder !== undefined) payload.sortOrder = parseNumber(body.sortOrder);
  if (body.capacityQuantity !== undefined) payload.capacityQuantity = parseNumber(body.capacityQuantity);

  for (const field of ["isReceivable", "isPickable", "isDispatchable", "isQuarantine"]) {
    if (body[field] !== undefined) payload[field] = parseBoolean(body[field]);
  }

  if (userId) payload.updatedBy = userId;
  return payload;
};

const validatePayload = (payload, { partial = false } = {}) => {
  const errors = [];

  if ((!partial || payload.warehouse !== undefined) && !payload.warehouse) {
    errors.push("Warehouse is required.");
  }
  if ((!partial || payload.name !== undefined) && !clean(payload.name)) errors.push("Location name is required.");
  if ((!partial || payload.code !== undefined) && !clean(payload.code)) errors.push("Location code is required.");

  for (const field of ["warehouse", "parent"]) {
    if (Object.prototype.hasOwnProperty.call(payload, field) && payload[field] === undefined) {
      errors.push(`${field} must be a valid ID or empty.`);
    }
  }

  for (const field of ["sortOrder", "capacityQuantity"]) {
    if (payload[field] !== undefined && (!Number.isFinite(payload[field]) || payload[field] < 0)) {
      errors.push(`${field} must be a valid non-negative number.`);
    }
  }

  if (payload.sortOrder !== undefined && !Number.isInteger(payload.sortOrder)) {
    errors.push("Sort order must be an integer.");
  }

  for (const field of ["isReceivable", "isPickable", "isDispatchable", "isQuarantine"]) {
    if (Object.prototype.hasOwnProperty.call(payload, field) && payload[field] === undefined) {
      errors.push(`${field} must be true or false.`);
    }
  }

  if (payload.locationType !== undefined && !LOCATION_TYPES.includes(payload.locationType)) {
    errors.push("Location type has an invalid value.");
  }
  if (payload.status !== undefined && !LOCATION_STATUSES.includes(payload.status)) {
    errors.push("Location status has an invalid value.");
  }
  if (payload.status === "archived") errors.push("Use the archive endpoint to archive a location.");

  return errors;
};

const loadWarehouse = async (warehouseId, { requireActive = false, session = null, tenantId = null } = {}) => {
  if (!isId(warehouseId)) {
    throw Object.assign(new Error("Select a valid warehouse."), { statusCode: 400 });
  }

  const query = Warehouse.findOne({
    _id: warehouseId,
    ...(tenantId ? { tenantId } : {}),
  }).select("name code status");
  if (session) query.session(session);
  const warehouse = await query.lean();
  if (!warehouse) throw Object.assign(new Error("Warehouse was not found."), { statusCode: 404 });
  if (warehouse.status === "archived") {
    throw Object.assign(new Error("An archived warehouse cannot contain active locations."), { statusCode: 409 });
  }
  if (requireActive && warehouse.status !== "active") {
    throw Object.assign(new Error("The selected warehouse must be active."), { statusCode: 409 });
  }
  return warehouse;
};

const resolveParent = async ({ parentId, warehouseId, requireActive = false, session = null, tenantId = null }) => {
  if (!parentId) return { parent: null, ancestors: [], depth: 0 };

  const query = WarehouseLocation.findOne({
    _id: parentId,
    ...(tenantId ? { tenantId } : {}),
  }).select("warehouse name code parent ancestors depth status");
  if (session) query.session(session);
  const parent = await query.lean();

  if (!parent) throw Object.assign(new Error("Parent warehouse location was not found."), { statusCode: 404 });
  if (String(parent.warehouse) !== String(warehouseId)) {
    throw Object.assign(new Error("Parent location must belong to the selected warehouse."), { statusCode: 409 });
  }
  if (parent.status === "archived") {
    throw Object.assign(new Error("An archived location cannot be used as a parent."), { statusCode: 409 });
  }
  if (requireActive && parent.status !== "active") {
    throw Object.assign(new Error("An active location must have an active parent location."), { statusCode: 409 });
  }

  const ancestors = [...(parent.ancestors || []), parent._id];
  if (ancestors.length > 20) {
    throw Object.assign(new Error("Warehouse location hierarchy cannot exceed 20 levels."), { statusCode: 409 });
  }

  return { parent, ancestors, depth: ancestors.length };
};

const duplicateMessage = (error) => {
  const fields = Object.keys(error?.keyPattern || error?.keyValue || {});
  if (fields.includes("code")) return "This warehouse already has a location with this code.";
  if (fields.includes("barcode")) return "This warehouse already has a location with this barcode.";
  if (fields.includes("parent") && fields.includes("nameLower")) {
    return "A location with this name already exists under the selected parent.";
  }
  return "A warehouse location with the same unique value already exists.";
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

const buildListFilter = (query = {}, tenantId = null) => {
  const filter = tenantId ? { tenantId } : {};

  if (isId(query.warehouse)) filter.warehouse = query.warehouse;
  if (query.status && query.status !== "all") filter.status = clean(query.status).toLowerCase();
  else filter.status = { $in: ["active", "inactive"] };

  if (query.locationType && query.locationType !== "all") {
    filter.locationType = clean(query.locationType).toLowerCase();
  }
  if (query.parent === "root" || query.parent === "null") filter.parent = null;
  else if (isId(query.parent)) filter.parent = query.parent;

  const isPickable = parseBoolean(query.isPickable);
  const isReceivable = parseBoolean(query.isReceivable);
  const isQuarantine = parseBoolean(query.isQuarantine);
  if (isPickable !== undefined) filter.isPickable = isPickable;
  if (isReceivable !== undefined) filter.isReceivable = isReceivable;
  if (isQuarantine !== undefined) filter.isQuarantine = isQuarantine;

  const q = clean(query.q);
  if (q) {
    filter.$or = [
      { nameLower: new RegExp(`^${escapeRegex(q.toLowerCase())}`) },
      { code: new RegExp(`^${escapeRegex(q.toUpperCase())}`) },
      { barcode: new RegExp(`^${escapeRegex(q.toUpperCase())}`) },
    ];
  }

  return filter;
};

const hasNonZeroStock = async (locationId, tenantId = null) =>
  Boolean(
    await ProductStock.exists({
      location: locationId,
      ...(tenantId ? { tenantId } : {}),
      $or: [
        { onHandQuantity: { $ne: 0 } },
        { reservedQuantity: { $ne: 0 } },
        { quarantineQuantity: { $ne: 0 } },
        { incomingQuantity: { $ne: 0 } },
        { outgoingQuantity: { $ne: 0 } },
      ],
    })
  );

export const listWarehouseLocations = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const limit = parseLimit(req.query.limit, 40, 150);
    const cursor = decodeCursor(req.query.cursor);
    if (req.query.cursor && !cursor) return res.status(400).json({ message: "Invalid pagination cursor." });

    const filter = buildListFilter(req.query, tenantId);
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

    const locations = await WarehouseLocation.find(filter)
      .select(`${LIST_FIELDS} +nameLower`)
      .populate("warehouse", "name code status")
      .populate("parent", "name code locationType status")
      .populate("ancestors", "name code locationType status")
      .sort({ sortOrder: 1, nameLower: 1, _id: 1 })
      .limit(limit + 1)
      .maxTimeMS(5000)
      .lean();

    const hasMore = locations.length > limit;
    if (hasMore) locations.pop();
    const nextCursor = hasMore && locations.length ? encodeCursor(locations.at(-1)) : null;
    const data = locations.map(({ nameLower, ...location }) => location);
    const stockRows = data.length
      ? await ProductStock.find({
          ...(tenantId ? { tenantId } : {}),
          location: { $in: data.map((location) => location._id) },
          status: { $ne: "archived" },
        })
          .select("location product onHandQuantity availableQuantity minimumStock status")
          .populate("product", "name sku minimumStock")
          .lean()
      : [];
    const enriched = attachWarehouseLocationStockDetails(data, stockRows);

    return res.json({ count: enriched.length, hasMore, nextCursor, locations: enriched });
  } catch (error) {
    return res.status(500).json({ message: "Failed to load warehouse locations.", error: error.message });
  }
};

export const listWarehouseLocationOptions = async (req, res) => {
  try {
    if (!isId(req.query.warehouse)) return res.status(400).json({ message: "Warehouse is required." });

    const tenantId = req.tenantId;
    const limit = parseLimit(req.query.limit, 50, 200);
    const filter = {
      warehouse: req.query.warehouse,
      status: "active",
      ...(tenantId ? { tenantId } : {}),
    };
    const purpose = clean(req.query.purpose).toLowerCase();
    if (purpose === "pick") filter.isPickable = true;
    if (purpose === "receive") filter.isReceivable = true;
    if (purpose === "dispatch") filter.isDispatchable = true;
    if (purpose === "quarantine") filter.isQuarantine = true;

    const q = clean(req.query.q);
    if (q) {
      filter.$or = [
        { nameLower: new RegExp(`^${escapeRegex(q.toLowerCase())}`) },
        { code: new RegExp(`^${escapeRegex(q.toUpperCase())}`) },
        { barcode: new RegExp(`^${escapeRegex(q.toUpperCase())}`) },
      ];
    }

    const locations = await WarehouseLocation.find(filter)
      .select(OPTION_FIELDS)
      .sort({ depth: 1, sortOrder: 1, nameLower: 1, _id: 1 })
      .limit(limit)
      .maxTimeMS(3000)
      .lean();

    return res.json({ count: locations.length, locations });
  } catch (error) {
    return res.status(500).json({ message: "Failed to load warehouse location options.", error: error.message });
  }
};

export const listWarehouseLocationTree = async (req, res) => {
  try {
    if (!isId(req.query.warehouse)) return res.status(400).json({ message: "Warehouse is required." });

    const tenantId = req.tenantId;
    const locations = await WarehouseLocation.find({
      warehouse: req.query.warehouse,
      status: req.query.includeInactive === "true" ? { $in: ["active", "inactive"] } : "active",
      ...(tenantId ? { tenantId } : {}),
    })
      .select(OPTION_FIELDS)
      .sort({ depth: 1, sortOrder: 1, nameLower: 1, _id: 1 })
      .limit(2000)
      .maxTimeMS(5000)
      .lean();

    const byParent = new Map();
    for (const location of locations) {
      const key = String(location.parent || "root");
      if (!byParent.has(key)) byParent.set(key, []);
      byParent.get(key).push({ ...location, children: [] });
    }

    const nodeMap = new Map();
    for (const children of byParent.values()) {
      for (const node of children) nodeMap.set(String(node._id), node);
    }

    const roots = [];
    for (const node of nodeMap.values()) {
      const parent = node.parent ? nodeMap.get(String(node.parent)) : null;
      if (parent) parent.children.push(node);
      else roots.push(node);
    }

    return res.json({ count: locations.length, locations: roots });
  } catch (error) {
    return res.status(500).json({ message: "Failed to load warehouse location tree.", error: error.message });
  }
};

export const getWarehouseLocation = async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(400).json({ message: "Invalid warehouse location ID." });

    const tenantId = req.tenantId;
    const location = await WarehouseLocation.findOne({
      _id: req.params.id,
      ...(tenantId ? { tenantId } : {}),
    })
      .select("-nameLower")
      .populate("warehouse", "name code status")
      .populate("parent", "name code locationType status")
      .populate("ancestors", "name code locationType depth status")
      .maxTimeMS(3000)
      .lean();

    if (!location) return res.status(404).json({ message: "Warehouse location not found." });
    return res.json({ location });
  } catch (error) {
    return res.status(500).json({ message: "Failed to load warehouse location.", error: error.message });
  }
};

export const createWarehouseLocation = async (req, res) => {
  try {
    const userId = req.user?._id || null;
    const tenantId = req.tenantId;
    const payload = buildLocationPayload(req.body, userId);
    if (tenantId) payload.tenantId = tenantId;
    const errors = validatePayload(payload);
    if (errors.length) return res.status(400).json({ message: errors[0], errors });

    await loadWarehouse(payload.warehouse, { requireActive: payload.status !== "inactive", tenantId });
    const hierarchy = await resolveParent({
      parentId: payload.parent,
      warehouseId: payload.warehouse,
      requireActive: payload.status !== "inactive",
      tenantId,
    });

    const location = await WarehouseLocation.create({
      ...payload,
      parent: payload.parent || null,
      ancestors: hierarchy.ancestors,
      depth: hierarchy.depth,
      locationType: payload.locationType || "bin",
      status: payload.status || "active",
      ...(tenantId ? { tenantId } : {}),
      createdBy: userId,
      updatedBy: userId,
    });

    return res.status(201).json({ message: "Warehouse location created.", location });
  } catch (error) {
    return sendWriteError(res, error, "Failed to create warehouse location.");
  }
};

export const updateWarehouseLocation = async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(400).json({ message: "Invalid warehouse location ID." });

    const tenantId = req.tenantId;
    const payload = buildLocationPayload(req.body, req.user?._id || null);
    const editableKeys = Object.keys(payload).filter((key) => key !== "updatedBy");
    if (!editableKeys.length) return res.status(400).json({ message: "No valid warehouse location fields were provided." });

    const errors = validatePayload(payload, { partial: true });
    if (errors.length) return res.status(400).json({ message: errors[0], errors });

    const current = await WarehouseLocation.findOne({
      _id: req.params.id,
      ...(tenantId ? { tenantId } : {}),
    })
      .select("warehouse parent ancestors depth status")
      .lean();
    if (!current) return res.status(404).json({ message: "Warehouse location not found." });
    if (current.status === "archived") {
      return res.status(409).json({ message: "Restore the archived location before editing it." });
    }

    const nextWarehouse = payload.warehouse !== undefined ? payload.warehouse : current.warehouse;
    const nextParent = payload.parent !== undefined ? payload.parent : current.parent;
    const hierarchyChanged =
      String(nextWarehouse || "") !== String(current.warehouse || "") ||
      String(nextParent || "") !== String(current.parent || "");

    if (hierarchyChanged) {
      if (String(req.params.id) === String(nextParent || "")) {
        return res.status(400).json({ message: "A warehouse location cannot be its own parent." });
      }

      const [hasChildren, hasStockRecord] = await Promise.all([
        WarehouseLocation.exists({ parent: req.params.id, ...(tenantId ? { tenantId } : {}) }),
        ProductStock.exists({ location: req.params.id, ...(tenantId ? { tenantId } : {}) }),
      ]);
      if (hasChildren || hasStockRecord) {
        return res.status(409).json({
          message: "Warehouse or parent cannot be changed after child locations or stock records exist.",
        });
      }
    }

    const nextStatus = payload.status || current.status;
    if (nextStatus === "inactive" && current.status === "active") {
      const hasActiveChildren = await WarehouseLocation.exists({
        parent: req.params.id,
        status: "active",
        ...(tenantId ? { tenantId } : {}),
      });
      if (hasActiveChildren) {
        return res.status(409).json({ message: "Deactivate active child locations first." });
      }
    }

    await loadWarehouse(nextWarehouse, { requireActive: nextStatus === "active", tenantId });
    const hierarchy = await resolveParent({
      parentId: nextParent,
      warehouseId: nextWarehouse,
      requireActive: nextStatus === "active",
      tenantId,
    });

    if (hierarchy.ancestors.some((id) => String(id) === String(req.params.id))) {
      return res.status(409).json({ message: "The selected parent would create a hierarchy cycle." });
    }

    const location = await WarehouseLocation.findOneAndUpdate(
      {
        _id: req.params.id,
        ...(tenantId ? { tenantId } : {}),
      },
      {
        ...payload,
        ...(hierarchyChanged
          ? {
              warehouse: nextWarehouse,
              parent: nextParent || null,
              ancestors: hierarchy.ancestors,
              depth: hierarchy.depth,
            }
          : {}),
      },
      { new: true, runValidators: true, context: "query" }
    ).select("-nameLower");

    return res.json({ message: "Warehouse location updated.", location });
  } catch (error) {
    return sendWriteError(res, error, "Failed to update warehouse location.");
  }
};

export const updateWarehouseLocationStatus = async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(400).json({ message: "Invalid warehouse location ID." });
    const status = clean(req.body.status).toLowerCase();
    if (!LOCATION_STATUSES.includes(status) || status === "archived") {
      return res.status(400).json({ message: "Status must be active or inactive." });
    }

    const tenantId = req.tenantId;
    const current = await WarehouseLocation.findOne({
      _id: req.params.id,
      ...(tenantId ? { tenantId } : {}),
    })
      .select("warehouse parent status")
      .lean();
    if (!current) return res.status(404).json({ message: "Warehouse location not found." });
    if (current.status === "archived") return res.status(409).json({ message: "Restore the location before changing its status." });

    if (status === "active") {
      await loadWarehouse(current.warehouse, { requireActive: true, tenantId });
      await resolveParent({ parentId: current.parent, warehouseId: current.warehouse, requireActive: true, tenantId });
    } else if (await WarehouseLocation.exists({ parent: req.params.id, status: "active", ...(tenantId ? { tenantId } : {}) })) {
      return res.status(409).json({ message: "Deactivate active child locations first." });
    }

    const location = await WarehouseLocation.findOneAndUpdate(
      {
        _id: req.params.id,
        ...(tenantId ? { tenantId } : {}),
      },
      { status, updatedBy: req.user?._id || null },
      { new: true, runValidators: true }
    ).select(LIST_FIELDS);

    return res.json({ message: "Warehouse location status updated.", location });
  } catch (error) {
    return sendWriteError(res, error, "Failed to update warehouse location status.");
  }
};

export const deleteWarehouseLocation = async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(400).json({ message: "Invalid warehouse location ID." });

    const tenantId = req.tenantId;
    const current = await WarehouseLocation.findOne({
      _id: req.params.id,
      ...(tenantId ? { tenantId } : {}),
    }).select("status").lean();
    if (!current) return res.status(404).json({ message: "Warehouse location not found." });
    if (current.status === "archived") return res.status(404).json({ message: "Warehouse location is already archived." });

    if (await WarehouseLocation.exists({ parent: req.params.id, status: { $ne: "archived" }, ...(tenantId ? { tenantId } : {}) })) {
      return res.status(409).json({ message: "Archive or move child locations first." });
    }
    if (await hasNonZeroStock(req.params.id, tenantId)) {
      return res.status(409).json({ message: "A location with stock balances or pending quantities cannot be archived." });
    }

    let location;
    await runMongoTransaction(async (session) => {
      const now = new Date();
      location = await WarehouseLocation.findOneAndUpdate(
        {
          _id: req.params.id,
          ...(tenantId ? { tenantId } : {}),
        },
        {
          status: "archived",
          archivedAt: now,
          isReceivable: false,
          isPickable: false,
          isDispatchable: false,
          updatedBy: req.user?._id || null,
        },
        { new: true, runValidators: true, session }
      ).select("name code status archivedAt");

      await ProductStock.updateMany(
        {
          location: req.params.id,
          status: { $ne: "archived" },
          ...(tenantId ? { tenantId } : {}),
        },
        { $set: { status: "archived", archivedAt: now, updatedBy: req.user?._id || null } },
        { session }
      );
    });

    return res.json({ message: "Warehouse location archived safely.", location });
  } catch (error) {
    return sendWriteError(res, error, "Failed to archive warehouse location.");
  }
};

export const restoreWarehouseLocation = async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(400).json({ message: "Invalid warehouse location ID." });

    const tenantId = req.tenantId;
    const current = await WarehouseLocation.findOne({
      _id: req.params.id,
      status: "archived",
      ...(tenantId ? { tenantId } : {}),
    })
      .select("warehouse parent")
      .lean();
    if (!current) return res.status(404).json({ message: "Archived warehouse location not found." });

    await loadWarehouse(current.warehouse, { tenantId });
    await resolveParent({ parentId: current.parent, warehouseId: current.warehouse, tenantId });

    const location = await WarehouseLocation.findOneAndUpdate(
      {
        _id: req.params.id,
        ...(tenantId ? { tenantId } : {}),
      },
      {
        status: "inactive",
        archivedAt: null,
        isReceivable: false,
        isPickable: false,
        isDispatchable: false,
        updatedBy: req.user?._id || null,
      },
      { new: true, runValidators: true }
    ).select(LIST_FIELDS);

    return res.json({ message: "Warehouse location restored as inactive.", location });
  } catch (error) {
    return sendWriteError(res, error, "Failed to restore warehouse location.");
  }
};
