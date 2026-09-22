import mongoose from "mongoose";
import { assignDocumentNumber } from "../../services/administration/documentNumbering.service.js";
import Product from "../../models/inventory/product.model.js";
import InventoryUnit, { UNIT_STATUSES, UNIT_TYPES } from "../../models/inventory/inventoryUnit.model.js";

const LIST_FIELDS = [
  "name",
  "code",
  "symbol",
  "unitType",
  "allowDecimal",
  "decimalPlaces",
  "description",
  "sortOrder",
  "status",
  "updatedAt",
].join(" ");

const OPTION_FIELDS = "name code symbol unitType allowDecimal decimalPlaces sortOrder status";

const clean = (value) => String(value ?? "").trim();
const isId = (value) => mongoose.Types.ObjectId.isValid(String(value || ""));
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const parseLimit = (value, fallback = 30, max = 100) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.trunc(parsed), 1), max);
};

const parseInteger = (value) => {
  if (value === "" || value === null || value === undefined) return undefined;
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : Number.NaN;
};

const parseBoolean = (value) => {
  if (value === true || value === "true") return true;
  if (value === false || value === "false") return false;
  return undefined;
};

const encodeCursor = (unit) => {
  const payload = JSON.stringify({
    s: Number(unit.sortOrder || 0),
    n: String(unit.nameLower || unit.name || "").toLowerCase(),
    id: String(unit._id),
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

const buildUnitPayload = (body = {}, userId = null) => {
  const payload = {};

  for (const field of ["name", "code", "symbol", "description"]) {
    if (body[field] !== undefined) payload[field] = clean(body[field]);
  }

  if (body.unitType !== undefined) payload.unitType = clean(body.unitType).toLowerCase();
  if (body.allowDecimal !== undefined) payload.allowDecimal = parseBoolean(body.allowDecimal);
  if (body.decimalPlaces !== undefined) payload.decimalPlaces = parseInteger(body.decimalPlaces);
  if (body.sortOrder !== undefined) payload.sortOrder = parseInteger(body.sortOrder);
  if (body.status !== undefined) payload.status = clean(body.status).toLowerCase();
  if (userId) payload.updatedBy = userId;

  return payload;
};

const validatePayload = (payload, { partial = false, current = null } = {}) => {
  const errors = [];

  if ((!partial || payload.name !== undefined) && !clean(payload.name)) {
    errors.push("Unit name is required.");
  }
  if ((!partial || payload.code !== undefined) && !clean(payload.code)) {
    errors.push("Unit code is required.");
  }
  if ((!partial || payload.symbol !== undefined) && !clean(payload.symbol)) {
    errors.push("Unit symbol is required.");
  }
  if (payload.unitType !== undefined && !UNIT_TYPES.includes(payload.unitType)) {
    errors.push("Unit type has an invalid value.");
  }
  if (payload.status !== undefined && !UNIT_STATUSES.includes(payload.status)) {
    errors.push("Unit status has an invalid value.");
  }
  if (payload.status === "archived") {
    errors.push("Use the unit archive endpoint to archive a unit.");
  }
  if (Object.prototype.hasOwnProperty.call(payload, "allowDecimal") && payload.allowDecimal === undefined) {
    errors.push("Allow decimal must be true or false.");
  }
  if (
    payload.decimalPlaces !== undefined &&
    (!Number.isInteger(payload.decimalPlaces) || payload.decimalPlaces < 0 || payload.decimalPlaces > 6)
  ) {
    errors.push("Decimal places must be an integer between 0 and 6.");
  }
  if (
    payload.sortOrder !== undefined &&
    (!Number.isInteger(payload.sortOrder) || payload.sortOrder < 0 || payload.sortOrder > 1000000)
  ) {
    errors.push("Sort order must be an integer between 0 and 1000000.");
  }

  const allowDecimal = payload.allowDecimal !== undefined ? payload.allowDecimal : current?.allowDecimal ?? false;
  const decimalPlaces = payload.decimalPlaces !== undefined ? payload.decimalPlaces : current?.decimalPlaces ?? 0;

  if (!allowDecimal && decimalPlaces !== 0) {
    errors.push("Decimal places must be 0 when decimal quantities are not allowed.");
  }
  if (allowDecimal && decimalPlaces < 1) {
    errors.push("Decimal places must be at least 1 when decimal quantities are allowed.");
  }

  return errors;
};

const duplicateMessage = (error) => {
  const fields = Object.keys(error?.keyPattern || error?.keyValue || {});
  if (fields.includes("code")) return "A unit with this code already exists.";
  if (fields.includes("nameLower")) return "A unit with this name already exists.";
  if (fields.includes("symbolKey")) return "A unit with this symbol already exists.";
  return "A unit with the same unique value already exists.";
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

  if (query.status && query.status !== "all") {
    filter.status = clean(query.status).toLowerCase();
  } else {
    filter.status = { $in: ["active", "inactive"] };
  }

  if (query.unitType && query.unitType !== "all") {
    filter.unitType = clean(query.unitType).toLowerCase();
  }

  const allowDecimal = parseBoolean(query.allowDecimal);
  if (allowDecimal !== undefined) filter.allowDecimal = allowDecimal;

  const q = clean(query.q);
  if (q) {
    const normalizedName = q.toLowerCase();
    const normalizedCode = q.toUpperCase();
    const normalizedSymbol = q.toLowerCase();
    filter.$or = [
      { nameLower: new RegExp(`^${escapeRegex(normalizedName)}`) },
      { code: new RegExp(`^${escapeRegex(normalizedCode)}`) },
      { symbolKey: new RegExp(`^${escapeRegex(normalizedSymbol)}`) },
    ];
  }

  return filter;
};

export const listInventoryUnits = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const limit = parseLimit(req.query.limit, 30, 100);
    const cursor = decodeCursor(req.query.cursor);
    const filter = buildListFilter(req.query, tenantId);

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

    const units = await InventoryUnit.find(filter)
      .select(`${LIST_FIELDS} +nameLower`)
      .sort({ sortOrder: 1, nameLower: 1, _id: 1 })
      .limit(limit + 1)
      .maxTimeMS(5000)
      .lean();

    const hasMore = units.length > limit;
    if (hasMore) units.pop();

    const nextCursor = hasMore && units.length ? encodeCursor(units[units.length - 1]) : null;
    const data = units.map(({ nameLower, ...unit }) => unit);

    return res.json({ count: data.length, hasMore, nextCursor, units: data });
  } catch (error) {
    return res.status(500).json({ message: "Failed to load inventory units.", error: error.message });
  }
};

export const listInventoryUnitOptions = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const limit = parseLimit(req.query.limit, 50, 200);
    const filter = {
      ...(tenantId ? { tenantId } : {}),
      status: "active",
    };

    if (req.query.unitType && req.query.unitType !== "all") {
      filter.unitType = clean(req.query.unitType).toLowerCase();
    }

    const q = clean(req.query.q);
    if (q) {
      const normalizedName = q.toLowerCase();
      const normalizedCode = q.toUpperCase();
      const normalizedSymbol = q.toLowerCase();
      filter.$or = [
        { nameLower: new RegExp(`^${escapeRegex(normalizedName)}`) },
        { code: new RegExp(`^${escapeRegex(normalizedCode)}`) },
        { symbolKey: new RegExp(`^${escapeRegex(normalizedSymbol)}`) },
      ];
    }

    const units = await InventoryUnit.find(filter)
      .select(OPTION_FIELDS)
      .sort({ sortOrder: 1, nameLower: 1, _id: 1 })
      .limit(limit)
      .maxTimeMS(3000)
      .lean();

    return res.json({ count: units.length, units });
  } catch (error) {
    return res.status(500).json({ message: "Failed to load unit options.", error: error.message });
  }
};

export const getInventoryUnit = async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(400).json({ message: "Invalid unit ID." });

    const unit = await InventoryUnit.findOne({
      _id: req.params.id,
      ...(req.tenantId ? { tenantId: req.tenantId } : {}),
    })
      .select("-nameLower -symbolKey")
      .maxTimeMS(3000)
      .lean();

    if (!unit) return res.status(404).json({ message: "Inventory unit not found." });
    return res.json({ unit });
  } catch (error) {
    return res.status(500).json({ message: "Failed to load inventory unit.", error: error.message });
  }
};

export const lookupInventoryUnit = async (req, res) => {
  try {
    const value = clean(req.params.value);
    if (!value) return res.status(400).json({ message: "Unit code or symbol is required." });

    const unit = await InventoryUnit.findOne({
      ...(req.tenantId ? { tenantId: req.tenantId } : {}),
      status: { $ne: "archived" },
      $or: [{ code: value.toUpperCase() }, { symbolKey: value.toLowerCase() }],
    })
      .select(LIST_FIELDS)
      .maxTimeMS(3000)
      .lean();

    if (!unit) return res.status(404).json({ message: "Inventory unit not found." });
    return res.json({ unit });
  } catch (error) {
    return res.status(500).json({ message: "Failed to find inventory unit.", error: error.message });
  }
};

export const createInventoryUnit = async (req, res) => {
  try {
    const userId = req.user?._id || null;
    const tenantId = req.tenantId;
    const payload = buildUnitPayload(req.body, userId);
    if (tenantId) payload.tenantId = tenantId;

    if (payload.allowDecimal === false) payload.decimalPlaces = 0;
    if (payload.allowDecimal === true && payload.decimalPlaces === undefined) payload.decimalPlaces = 2;

    const errors = validatePayload(payload, { partial: true });
    if (errors.length) return res.status(400).json({ message: errors[0], errors });
    payload.code = (await assignDocumentNumber({ tenantId, typeKey: "inventory.unit", providedValue: payload.code, source: "inventory.unit.create" })).value;
    const fullErrors = validatePayload(payload);
    if (fullErrors.length) return res.status(400).json({ message: fullErrors[0], errors: fullErrors });

    const unit = await InventoryUnit.create({
      ...payload,
      ...(tenantId ? { tenantId } : {}),
      createdBy: userId,
      updatedBy: userId,
    });

    return res.status(201).json({ message: "Inventory unit created.", unit });
  } catch (error) {
    return sendWriteError(res, error, "Failed to create inventory unit.");
  }
};

export const updateInventoryUnit = async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(400).json({ message: "Invalid unit ID." });

    const tenantId = req.tenantId;
    const payload = buildUnitPayload(req.body, req.user?._id || null);
    const editableKeys = Object.keys(payload).filter((key) => key !== "updatedBy");
    if (!editableKeys.length) return res.status(400).json({ message: "No valid unit fields were provided." });

    const current = await InventoryUnit.findOne({
      _id: req.params.id,
      ...(tenantId ? { tenantId } : {}),
    })
      .select("allowDecimal decimalPlaces status")
      .maxTimeMS(3000)
      .lean();

    if (!current) return res.status(404).json({ message: "Inventory unit not found." });
    if (current.status === "archived") {
      return res.status(409).json({ message: "Restore the archived unit before editing it." });
    }

    if (payload.allowDecimal === false) payload.decimalPlaces = 0;
    if (payload.allowDecimal === true && payload.decimalPlaces === undefined && !current.allowDecimal) {
      payload.decimalPlaces = 2;
    }

    const errors = validatePayload(payload, { partial: true, current });
    if (errors.length) return res.status(400).json({ message: errors[0], errors });

    const unit = await InventoryUnit.findOneAndUpdate(
      {
        _id: req.params.id,
        ...(tenantId ? { tenantId } : {}),
      },
      payload,
      {
        new: true,
        runValidators: true,
        context: "query",
      }
    ).select("-nameLower -symbolKey");

    return res.json({ message: "Inventory unit updated.", unit });
  } catch (error) {
    return sendWriteError(res, error, "Failed to update inventory unit.");
  }
};

export const updateInventoryUnitStatus = async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(400).json({ message: "Invalid unit ID." });

    const tenantId = req.tenantId;
    const status = clean(req.body.status).toLowerCase();
    if (!["active", "inactive"].includes(status)) {
      return res.status(400).json({ message: "Status must be active or inactive." });
    }

    const unit = await InventoryUnit.findOneAndUpdate(
      {
        _id: req.params.id,
        ...(tenantId ? { tenantId } : {}),
        status: { $ne: "archived" },
      },
      { status, archivedAt: null, updatedBy: req.user?._id || null },
      { new: true, runValidators: true }
    ).select(LIST_FIELDS);

    if (!unit) return res.status(404).json({ message: "Inventory unit not found or archived." });
    return res.json({ message: "Inventory unit status updated.", unit });
  } catch (error) {
    return sendWriteError(res, error, "Failed to update inventory unit status.");
  }
};

export const deleteInventoryUnit = async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(400).json({ message: "Invalid unit ID." });

    const tenantId = req.tenantId;
    const current = await InventoryUnit.findOne({
      _id: req.params.id,
      ...(tenantId ? { tenantId } : {}),
    })
      .select("name code status")
      .maxTimeMS(3000)
      .lean();

    if (!current || current.status === "archived") {
      return res.status(404).json({ message: "Inventory unit not found or already archived." });
    }

    const hasProducts = await Product.exists({
      ...(tenantId ? { tenantId } : {}),
      baseUnit: req.params.id,
      status: { $ne: "archived" },
    });
    if (hasProducts) {
      return res.status(409).json({ message: "Change the base unit of assigned products before archiving this unit." });
    }

    const unit = await InventoryUnit.findOneAndUpdate(
      {
        _id: req.params.id,
        ...(tenantId ? { tenantId } : {}),
      },
      { status: "archived", archivedAt: new Date(), updatedBy: req.user?._id || null },
      { new: true, runValidators: true }
    ).select("name code symbol status archivedAt");

    return res.json({ message: "Inventory unit archived.", unit });
  } catch (error) {
    return sendWriteError(res, error, "Failed to archive inventory unit.");
  }
};

export const restoreInventoryUnit = async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(400).json({ message: "Invalid unit ID." });

    const tenantId = req.tenantId;
    const unit = await InventoryUnit.findOneAndUpdate(
      {
        _id: req.params.id,
        ...(tenantId ? { tenantId } : {}),
        status: "archived",
      },
      { status: "inactive", archivedAt: null, updatedBy: req.user?._id || null },
      { new: true, runValidators: true }
    ).select(LIST_FIELDS);

    if (!unit) return res.status(404).json({ message: "Archived inventory unit not found." });
    return res.json({ message: "Inventory unit restored as inactive.", unit });
  } catch (error) {
    return sendWriteError(res, error, "Failed to restore inventory unit.");
  }
};
