import mongoose from "mongoose";
import Warehouse, { WAREHOUSE_STATUSES, WAREHOUSE_TYPES } from "../../models/inventory/warehouse.model.js";
import WarehouseLocation from "../../models/inventory/warehouseLocation.model.js";
import ProductStock from "../../models/inventory/productStock.model.js";

const LIST_FIELDS = [
  "name",
  "code",
  "warehouseType",
  "branch",
  "manager",
  "address",
  "contactName",
  "phone",
  "email",
  "timezone",
  "isDefault",
  "allowNegativeStock",
  "status",
  "updatedAt",
].join(" ");

const OPTION_FIELDS = "name code warehouseType branch isDefault status";

const clean = (value) => String(value ?? "").trim();
const isId = (value) => mongoose.Types.ObjectId.isValid(String(value || ""));
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const parseLimit = (value, fallback = 30, max = 100) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.trunc(parsed), 1), max);
};

const parseBoolean = (value) => {
  if (value === true || value === "true") return true;
  if (value === false || value === "false") return false;
  return undefined;
};

const nullableId = (value) => {
  const normalized = clean(value);
  if (!normalized) return null;
  return isId(normalized) ? normalized : undefined;
};

const encodeCursor = (warehouse) =>
  Buffer.from(
    JSON.stringify({
      n: String(warehouse.nameLower || warehouse.name || "").toLowerCase(),
      id: String(warehouse._id),
    }),
    "utf8"
  ).toString("base64url");

const decodeCursor = (value) => {
  try {
    if (!value) return null;
    const parsed = JSON.parse(Buffer.from(String(value), "base64url").toString("utf8"));
    if (typeof parsed?.n !== "string" || !isId(parsed?.id)) return null;
    return { nameLower: parsed.n, id: new mongoose.Types.ObjectId(parsed.id) };
  } catch {
    return null;
  }
};

const buildAddress = (address = {}) => ({
  addressLine1: clean(address.addressLine1),
  addressLine2: clean(address.addressLine2),
  area: clean(address.area),
  city: clean(address.city),
  state: clean(address.state),
  postalCode: clean(address.postalCode),
  country: clean(address.country || "Bangladesh") || "Bangladesh",
});

const buildWarehousePayload = (body = {}, userId = null) => {
  const payload = {};

  for (const field of ["name", "code", "description", "contactName", "phone", "email", "timezone"]) {
    if (body[field] !== undefined) payload[field] = clean(body[field]);
  }

  if (body.warehouseType !== undefined) payload.warehouseType = clean(body.warehouseType).toLowerCase();
  if (body.status !== undefined) payload.status = clean(body.status).toLowerCase();
  if (body.branch !== undefined) payload.branch = nullableId(body.branch);
  if (body.manager !== undefined) payload.manager = nullableId(body.manager);
  if (body.address !== undefined) payload.address = buildAddress(body.address || {});
  if (body.isDefault !== undefined) payload.isDefault = parseBoolean(body.isDefault);
  if (body.allowNegativeStock !== undefined) {
    payload.allowNegativeStock = parseBoolean(body.allowNegativeStock);
  }
  if (userId) payload.updatedBy = userId;

  return payload;
};

const validatePayload = (payload, { partial = false } = {}) => {
  const errors = [];

  if ((!partial || payload.name !== undefined) && !clean(payload.name)) errors.push("Warehouse name is required.");
  if ((!partial || payload.code !== undefined) && !clean(payload.code)) errors.push("Warehouse code is required.");

  for (const field of ["branch", "manager"]) {
    if (Object.prototype.hasOwnProperty.call(payload, field) && payload[field] === undefined) {
      errors.push(`${field} must be a valid ID or empty.`);
    }
  }

  for (const field of ["isDefault", "allowNegativeStock"]) {
    if (Object.prototype.hasOwnProperty.call(payload, field) && payload[field] === undefined) {
      errors.push(`${field} must be true or false.`);
    }
  }

  if (payload.warehouseType !== undefined && !WAREHOUSE_TYPES.includes(payload.warehouseType)) {
    errors.push("Warehouse type has an invalid value.");
  }
  if (payload.status !== undefined && !WAREHOUSE_STATUSES.includes(payload.status)) {
    errors.push("Warehouse status has an invalid value.");
  }
  if (payload.status === "archived") errors.push("Use the archive endpoint to archive a warehouse.");
  if (payload.isDefault && payload.status && payload.status !== "active") {
    errors.push("Only an active warehouse can be the default warehouse.");
  }

  return errors;
};

const duplicateMessage = (error) => {
  const fields = Object.keys(error?.keyPattern || error?.keyValue || {});
  if (fields.includes("code")) return "A warehouse with this code already exists.";
  if (fields.includes("isDefault")) return "This branch already has a default warehouse.";
  return "A warehouse with the same unique value already exists.";
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

  if (query.status && query.status !== "all") filter.status = clean(query.status).toLowerCase();
  else filter.status = { $in: ["active", "inactive"] };

  if (query.warehouseType && query.warehouseType !== "all") {
    filter.warehouseType = clean(query.warehouseType).toLowerCase();
  }
  if (query.branch === "none" || query.branch === "null") filter.branch = null;
  else if (isId(query.branch)) filter.branch = query.branch;

  const isDefault = parseBoolean(query.isDefault);
  if (isDefault !== undefined) filter.isDefault = isDefault;

  const q = clean(query.q);
  if (q) {
    const name = q.toLowerCase();
    const code = q.toUpperCase();
    filter.$or = [
      { nameLower: new RegExp(`^${escapeRegex(name)}`) },
      { code: new RegExp(`^${escapeRegex(code)}`) },
    ];
  }

  return filter;
};

const stockExists = async (warehouseId, { nonZeroOnly = false, session = null } = {}) => {
  const filter = { warehouse: warehouseId };
  if (nonZeroOnly) {
    filter.$or = [
      { onHandQuantity: { $ne: 0 } },
      { reservedQuantity: { $ne: 0 } },
      { quarantineQuantity: { $ne: 0 } },
      { incomingQuantity: { $ne: 0 } },
      { outgoingQuantity: { $ne: 0 } },
    ];
  }
  const query = ProductStock.exists(filter);
  if (session) query.session(session);
  return Boolean(await query);
};

export const listWarehouses = async (req, res) => {
  try {
    const limit = parseLimit(req.query.limit, 30, 100);
    const cursor = decodeCursor(req.query.cursor);
    if (req.query.cursor && !cursor) return res.status(400).json({ message: "Invalid pagination cursor." });

    const filter = buildListFilter(req.query);
    if (cursor) {
      filter.$and = [
        ...(filter.$and || []),
        {
          $or: [
            { nameLower: { $gt: cursor.nameLower } },
            { nameLower: cursor.nameLower, _id: { $gt: cursor.id } },
          ],
        },
      ];
    }

    const warehouses = await Warehouse.find(filter)
      .select(`${LIST_FIELDS} +nameLower`)
      .populate("branch", "name code status")
      .populate("manager", "name email")
      .sort({ nameLower: 1, _id: 1 })
      .limit(limit + 1)
      .maxTimeMS(5000)
      .lean();

    const hasMore = warehouses.length > limit;
    if (hasMore) warehouses.pop();
    const nextCursor = hasMore && warehouses.length ? encodeCursor(warehouses.at(-1)) : null;
    const data = warehouses.map(({ nameLower, ...warehouse }) => warehouse);

    return res.json({ count: data.length, hasMore, nextCursor, warehouses: data });
  } catch (error) {
    return res.status(500).json({ message: "Failed to load warehouses.", error: error.message });
  }
};

export const listWarehouseOptions = async (req, res) => {
  try {
    const limit = parseLimit(req.query.limit, 30, 100);
    const filter = { status: "active" };
    if (isId(req.query.branch)) filter.branch = req.query.branch;

    const q = clean(req.query.q);
    if (q) {
      filter.$or = [
        { nameLower: new RegExp(`^${escapeRegex(q.toLowerCase())}`) },
        { code: new RegExp(`^${escapeRegex(q.toUpperCase())}`) },
      ];
    }

    const warehouses = await Warehouse.find(filter)
      .select(OPTION_FIELDS)
      .sort({ isDefault: -1, nameLower: 1, _id: 1 })
      .limit(limit)
      .maxTimeMS(3000)
      .lean();

    return res.json({ count: warehouses.length, warehouses });
  } catch (error) {
    return res.status(500).json({ message: "Failed to load warehouse options.", error: error.message });
  }
};

export const getWarehouse = async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(400).json({ message: "Invalid warehouse ID." });

    const warehouse = await Warehouse.findById(req.params.id)
      .select("-nameLower")
      .populate("branch", "name code status")
      .populate("manager", "name email")
      .populate("createdBy", "name email")
      .populate("updatedBy", "name email")
      .maxTimeMS(3000)
      .lean();

    if (!warehouse) return res.status(404).json({ message: "Warehouse not found." });

    let stats;
    if (parseBoolean(req.query.includeStats) === true) {
      const [locationCount, stockSummary] = await Promise.all([
        WarehouseLocation.countDocuments({ warehouse: warehouse._id, status: { $ne: "archived" } }).maxTimeMS(3000),
        ProductStock.aggregate([
          { $match: { warehouse: warehouse._id, status: { $ne: "archived" } } },
          {
            $group: {
              _id: null,
              stockRows: { $sum: 1 },
              products: { $addToSet: "$product" },
              onHandQuantity: { $sum: "$onHandQuantity" },
              availableQuantity: { $sum: "$availableQuantity" },
              inventoryValue: { $sum: "$inventoryValue" },
            },
          },
          {
            $project: {
              _id: 0,
              stockRows: 1,
              productCount: { $size: "$products" },
              onHandQuantity: 1,
              availableQuantity: 1,
              inventoryValue: 1,
            },
          },
        ]).option({ maxTimeMS: 5000 }),
      ]);
      stats = { locationCount, ...(stockSummary[0] || { stockRows: 0, productCount: 0, onHandQuantity: 0, availableQuantity: 0, inventoryValue: 0 }) };
    }

    return res.json({ warehouse, ...(stats ? { stats } : {}) });
  } catch (error) {
    return res.status(500).json({ message: "Failed to load warehouse.", error: error.message });
  }
};

export const createWarehouse = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    const userId = req.user?._id || null;
    const payload = buildWarehousePayload(req.body, userId);
    const errors = validatePayload(payload);
    if (errors.length) return res.status(400).json({ message: errors[0], errors });

    payload.warehouseType = payload.warehouseType || "store";
    payload.status = payload.status || "active";
    payload.timezone = payload.timezone || "Asia/Dhaka";
    payload.branch = payload.branch ?? null;
    payload.manager = payload.manager ?? null;

    let warehouse;
    await session.withTransaction(async () => {
      if (payload.isDefault) {
        await Warehouse.updateMany(
          { branch: payload.branch, isDefault: true },
          { $set: { isDefault: false, updatedBy: userId } },
          { session }
        );
      }
      warehouse = new Warehouse({ ...payload, createdBy: userId, updatedBy: userId });
      await warehouse.save({ session });
    });

    return res.status(201).json({ message: "Warehouse created.", warehouse });
  } catch (error) {
    return sendWriteError(res, error, "Failed to create warehouse.");
  } finally {
    await session.endSession();
  }
};

export const updateWarehouse = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    if (!isId(req.params.id)) return res.status(400).json({ message: "Invalid warehouse ID." });

    const userId = req.user?._id || null;
    const payload = buildWarehousePayload(req.body, userId);
    const editableKeys = Object.keys(payload).filter((key) => key !== "updatedBy");
    if (!editableKeys.length) return res.status(400).json({ message: "No valid warehouse fields were provided." });

    const errors = validatePayload(payload, { partial: true });
    if (errors.length) return res.status(400).json({ message: errors[0], errors });

    const current = await Warehouse.findById(req.params.id)
      .select("branch isDefault status")
      .maxTimeMS(3000)
      .lean();
    if (!current) return res.status(404).json({ message: "Warehouse not found." });
    if (current.status === "archived") {
      return res.status(409).json({ message: "Restore the archived warehouse before editing it." });
    }

    const nextStatus = payload.status || current.status;
    const nextDefault = payload.isDefault !== undefined ? payload.isDefault : current.isDefault;
    if (nextDefault && nextStatus !== "active") {
      return res.status(409).json({ message: "The default warehouse must remain active." });
    }

    if (payload.branch !== undefined && String(payload.branch || "") !== String(current.branch || "")) {
      const [hasLocations, hasStocks] = await Promise.all([
        WarehouseLocation.exists({ warehouse: req.params.id }),
        stockExists(req.params.id),
      ]);
      if (hasLocations || hasStocks) {
        return res.status(409).json({ message: "Branch cannot be changed after locations or stock records exist." });
      }
    }

    let warehouse;
    await session.withTransaction(async () => {
      const nextBranch = payload.branch !== undefined ? payload.branch : current.branch || null;
      if (nextDefault) {
        await Warehouse.updateMany(
          { _id: { $ne: req.params.id }, branch: nextBranch, isDefault: true },
          { $set: { isDefault: false, updatedBy: userId } },
          { session }
        );
      }
      warehouse = await Warehouse.findByIdAndUpdate(req.params.id, payload, {
        new: true,
        runValidators: true,
        context: "query",
        session,
      }).select("-nameLower");
    });

    return res.json({ message: "Warehouse updated.", warehouse });
  } catch (error) {
    return sendWriteError(res, error, "Failed to update warehouse.");
  } finally {
    await session.endSession();
  }
};

export const updateWarehouseStatus = async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(400).json({ message: "Invalid warehouse ID." });
    const status = clean(req.body.status).toLowerCase();
    if (!WAREHOUSE_STATUSES.includes(status) || status === "archived") {
      return res.status(400).json({ message: "Status must be active or inactive." });
    }

    const current = await Warehouse.findById(req.params.id).select("isDefault status").lean();
    if (!current) return res.status(404).json({ message: "Warehouse not found." });
    if (current.status === "archived") return res.status(409).json({ message: "Restore the warehouse before changing its status." });
    if (current.isDefault && status !== "active") {
      return res.status(409).json({ message: "Set another warehouse as default before deactivating this warehouse." });
    }

    const warehouse = await Warehouse.findByIdAndUpdate(
      req.params.id,
      { status, updatedBy: req.user?._id || null },
      { new: true, runValidators: true }
    ).select(LIST_FIELDS);

    return res.json({ message: "Warehouse status updated.", warehouse });
  } catch (error) {
    return sendWriteError(res, error, "Failed to update warehouse status.");
  }
};

export const deleteWarehouse = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    if (!isId(req.params.id)) return res.status(400).json({ message: "Invalid warehouse ID." });

    const current = await Warehouse.findById(req.params.id).select("isDefault status").lean();
    if (!current) return res.status(404).json({ message: "Warehouse not found." });
    if (current.status === "archived") return res.status(404).json({ message: "Warehouse is already archived." });
    if (current.isDefault) {
      return res.status(409).json({ message: "Set another warehouse as default before archiving this warehouse." });
    }
    if (await stockExists(req.params.id, { nonZeroOnly: true })) {
      return res.status(409).json({ message: "A warehouse with stock activity or balances cannot be archived." });
    }

    let warehouse;
    await session.withTransaction(async () => {
      const now = new Date();
      warehouse = await Warehouse.findByIdAndUpdate(
        req.params.id,
        { status: "archived", archivedAt: now, isDefault: false, updatedBy: req.user?._id || null },
        { new: true, runValidators: true, session }
      ).select("name code status archivedAt");

      await WarehouseLocation.updateMany(
        { warehouse: req.params.id, status: { $ne: "archived" } },
        {
          $set: {
            status: "archived",
            archivedAt: now,
            isReceivable: false,
            isPickable: false,
            isDispatchable: false,
            updatedBy: req.user?._id || null,
          },
        },
        { session }
      );

      await ProductStock.updateMany(
        { warehouse: req.params.id, status: { $ne: "archived" } },
        { $set: { status: "archived", archivedAt: now, updatedBy: req.user?._id || null } },
        { session }
      );
    });

    return res.json({ message: "Warehouse archived. Zero-balance locations and stock records were archived safely.", warehouse });
  } catch (error) {
    return sendWriteError(res, error, "Failed to archive warehouse.");
  } finally {
    await session.endSession();
  }
};

export const restoreWarehouse = async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(400).json({ message: "Invalid warehouse ID." });

    const warehouse = await Warehouse.findOneAndUpdate(
      { _id: req.params.id, status: "archived" },
      { status: "inactive", archivedAt: null, isDefault: false, updatedBy: req.user?._id || null },
      { new: true, runValidators: true }
    ).select(LIST_FIELDS);

    if (!warehouse) return res.status(404).json({ message: "Archived warehouse not found." });
    return res.json({ message: "Warehouse restored as inactive. Restore its locations separately when needed.", warehouse });
  } catch (error) {
    return sendWriteError(res, error, "Failed to restore warehouse.");
  }
};
