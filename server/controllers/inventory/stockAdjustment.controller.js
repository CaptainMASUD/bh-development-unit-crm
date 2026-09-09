import mongoose from "mongoose";
import Product from "../../models/inventory/product.model.js";
import Warehouse from "../../models/inventory/warehouse.model.js";
import WarehouseLocation from "../../models/inventory/warehouseLocation.model.js";
import ProductStock, { roundMoney, roundQuantity } from "../../models/inventory/productStock.model.js";
import StockMovement from "../../models/inventory/stockMovement.model.js";
import StockAdjustment, {
  ADJUSTMENT_MODES,
  ADJUSTMENT_STATUSES,
  ADJUSTMENT_TYPES,
} from "../../models/inventory/stockAdjustment.model.js";
import {
  postInventoryAdjustmentAccounting,
  reverseProcurementAccounting,
} from "../../services/procurementAccounting.service.js";
import {
  postStockAdjustmentMovement,
  reverseStockAdjustmentMovement,
} from "../../services/inventoryPosting.service.js";
import { runMongoTransaction } from "../../utils/mongoTransaction.js";
import { InventoryPreference } from "../../models/inventory/inventoryOperations.model.js";
import { writeAudit } from "../../utils/audit.js";

const LIST_FIELDS = [
  "adjustmentNo",
  "adjustmentDate",
  "warehouse",
  "adjustmentType",
  "adjustmentMode",
  "status",
  "reference",
  "currency",
  "reason",
  "products",
  "locations",
  "lineCount",
  "increaseQuantity",
  "decreaseQuantity",
  "netQuantity",
  "increaseValue",
  "decreaseValue",
  "netValue",
  "submittedAt",
  "approvedAt",
  "postedAt",
  "movement",
  "reversalMovement",
  "journalEntry",
  "reversalJournalEntry",
  "createdBy",
  "updatedAt",
].join(" ");

const clean = (value) => String(value ?? "").trim();
const isId = (value) => mongoose.Types.ObjectId.isValid(String(value || ""));
const idKey = (value) => String(value || "");
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const positionKey = (product, location = null) => `${idKey(product)}:${location ? idKey(location) : "none"}`;

const parseLimit = (value, fallback = 30, max = 100) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.trunc(parsed), 1), max);
};

const parseDate = (value, fallback = null) => {
  if (!value) return fallback;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
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

const uniqueIds = (values = []) => {
  const seen = new Set();
  return values.filter(Boolean).filter((value) => {
    const key = idKey(value);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const sanitizeSerialNumbers = (values) => {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.map((value) => clean(value).toUpperCase()).filter(Boolean))];
};

const encodeCursor = (adjustment) =>
  Buffer.from(
    JSON.stringify({ d: new Date(adjustment.adjustmentDate).toISOString(), id: String(adjustment._id) }),
    "utf8"
  ).toString("base64url");

const decodeCursor = (value) => {
  try {
    if (!value) return null;
    const parsed = JSON.parse(Buffer.from(String(value), "base64url").toString("utf8"));
    const date = parseDate(parsed?.d);
    if (!date || !isId(parsed?.id)) return null;
    return { date, id: new mongoose.Types.ObjectId(parsed.id) };
  } catch {
    return null;
  }
};

const buildLineInput = (line = {}) => ({
  product: nullableId(line.product),
  location: nullableId(line.location),
  countedQuantity: parseNumber(line.countedQuantity),
  varianceQuantity: parseNumber(line.varianceQuantity ?? line.quantityDelta),
  unitCost: parseNumber(line.unitCost),
  lotNumber: clean(line.lotNumber).toUpperCase(),
  serialNumbers: sanitizeSerialNumbers(line.serialNumbers),
  note: clean(line.note),
});

const buildAdjustmentPayload = (body = {}, userId = null) => {
  const payload = {};
  if (body.adjustmentDate !== undefined) payload.adjustmentDate = parseDate(body.adjustmentDate);
  if (body.warehouse !== undefined) payload.warehouse = nullableId(body.warehouse);
  if (body.adjustmentType !== undefined) payload.adjustmentType = clean(body.adjustmentType).toLowerCase();
  if (body.adjustmentMode !== undefined) payload.adjustmentMode = clean(body.adjustmentMode).toLowerCase();
  if (body.reference !== undefined) payload.reference = clean(body.reference).toUpperCase();
  if (body.idempotencyKey !== undefined) payload.idempotencyKey = clean(body.idempotencyKey);
  if (body.currency !== undefined) payload.currency = clean(body.currency || "BDT").toUpperCase();
  if (body.reason !== undefined) payload.reason = clean(body.reason);
  if (body.notes !== undefined) payload.notes = clean(body.notes);
  if (body.lines !== undefined) payload.lines = Array.isArray(body.lines) ? body.lines.map(buildLineInput) : undefined;
  if (userId) payload.updatedBy = userId;
  return payload;
};

const validatePayload = (payload, { partial = false } = {}) => {
  const errors = [];
  if ((!partial || payload.adjustmentDate !== undefined) && !payload.adjustmentDate) {
    errors.push("A valid adjustment date is required.");
  }
  if ((!partial || payload.warehouse !== undefined) && !payload.warehouse) {
    errors.push("A valid warehouse is required.");
  }
  if ((!partial || payload.adjustmentType !== undefined) && !ADJUSTMENT_TYPES.includes(payload.adjustmentType)) {
    errors.push("Adjustment type has an invalid value.");
  }
  if ((!partial || payload.adjustmentMode !== undefined) && !ADJUSTMENT_MODES.includes(payload.adjustmentMode)) {
    errors.push("Adjustment mode must be count or delta.");
  }
  if ((!partial || payload.lines !== undefined) && (!Array.isArray(payload.lines) || !payload.lines.length)) {
    errors.push("At least one adjustment line is required.");
  }
  if (Array.isArray(payload.lines) && payload.lines.length > 500) {
    errors.push("An adjustment cannot contain more than 500 lines.");
  }
  for (let index = 0; index < (payload.lines || []).length; index += 1) {
    const line = payload.lines[index];
    if (!line.product) errors.push(`Line ${index + 1}: product is required.`);
    if (line.location === undefined) errors.push(`Line ${index + 1}: location is invalid.`);
    if (line.unitCost !== undefined && (!Number.isFinite(line.unitCost) || line.unitCost < 0)) {
      errors.push(`Line ${index + 1}: unit cost must be a valid non-negative number.`);
    }
  }
  return errors;
};

const duplicateMessage = (error) => {
  const field = Object.keys(error?.keyPattern || error?.keyValue || {})[0];
  if (field === "idempotencyKey") return "This stock adjustment request already exists.";
  if (field === "adjustmentNo") return "A stock adjustment with this number already exists.";
  if (field === "movement") return "This stock adjustment has already been posted.";
  return "A duplicate stock adjustment already exists.";
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
    ...(error?.staleLines ? { staleLines: error.staleLines } : {}),
  });
};

const buildStockQuery = (warehouse, lines) => ({
  warehouse,
  $or: lines.map((line) => ({ product: line.product, location: line.location || null })),
});

const resolveAdjustmentLines = async ({ tenantId = null, warehouseId, mode, lines, session = null }) => {
  if (!isId(warehouseId)) throw Object.assign(new Error("Select a valid warehouse."), { statusCode: 400 });
  if (!ADJUSTMENT_MODES.includes(mode)) {
    throw Object.assign(new Error("Adjustment mode must be count or delta."), { statusCode: 400 });
  }
  if (!Array.isArray(lines) || !lines.length || lines.length > 500) {
    throw Object.assign(new Error("An adjustment must contain between 1 and 500 lines."), { statusCode: 400 });
  }

  const warehouseQuery = Warehouse.findOne({ _id: warehouseId, ...(tenantId ? { tenantId } : {}) })
    .select("name code status allowNegativeStock")
    .lean();
  if (session) warehouseQuery.session(session);
  const warehouse = await warehouseQuery;
  if (!warehouse) throw Object.assign(new Error("Warehouse was not found."), { statusCode: 404 });
  if (warehouse.status !== "active") {
    throw Object.assign(new Error("Stock can only be adjusted in an active warehouse."), { statusCode: 409 });
  }

  const duplicateKeys = new Set();
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!isId(line.product)) throw Object.assign(new Error(`Line ${index + 1}: select a valid product.`), { statusCode: 400 });
    if (line.location && !isId(line.location)) {
      throw Object.assign(new Error(`Line ${index + 1}: select a valid location or leave it empty.`), { statusCode: 400 });
    }
    const key = positionKey(line.product, line.location);
    if (duplicateKeys.has(key)) {
      throw Object.assign(new Error(`Line ${index + 1}: the same product and location is already included.`), { statusCode: 409 });
    }
    duplicateKeys.add(key);
  }

  const productIds = uniqueIds(lines.map((line) => line.product));
  const locationIds = uniqueIds(lines.map((line) => line.location));
  const productQuery = Product.find({ _id: { $in: productIds }, ...(tenantId ? { tenantId } : {}) })
    .select("name sku productType trackInventory trackingType purchasePrice allowNegativeStock status")
    .lean();
  const locationQuery = locationIds.length
    ? WarehouseLocation.find({ _id: { $in: locationIds }, ...(tenantId ? { tenantId } : {}) })
        .select("warehouse name code status isQuarantine")
        .lean()
    : Promise.resolve([]);
  const stockQuery = ProductStock.find({ ...buildStockQuery(warehouseId, lines), ...(tenantId ? { tenantId } : {}) })
    .select("product location onHandQuantity averageCost stockVersion status")
    .lean();

  if (session) {
    productQuery.session(session);
    if (locationIds.length) locationQuery.session(session);
    stockQuery.session(session);
  }

  const [products, locations, stocks] = await Promise.all([productQuery, locationQuery, stockQuery]);
  const productMap = new Map(products.map((item) => [idKey(item._id), item]));
  const locationMap = new Map(locations.map((item) => [idKey(item._id), item]));
  const stockMap = new Map(stocks.map((item) => [positionKey(item.product, item.location), item]));

  return lines.map((line, index) => {
    const label = `Line ${index + 1}`;
    const product = productMap.get(idKey(line.product));
    if (!product) throw Object.assign(new Error(`${label}: product was not found.`), { statusCode: 404 });
    if (product.status !== "active" || product.productType !== "inventory" || product.trackInventory !== true) {
      throw Object.assign(new Error(`${label}: product must be active and inventory-tracked.`), { statusCode: 409 });
    }

    if (line.location) {
      const location = locationMap.get(idKey(line.location));
      if (!location) throw Object.assign(new Error(`${label}: warehouse location was not found.`), { statusCode: 404 });
      if (location.status !== "active") {
        throw Object.assign(new Error(`${label}: warehouse location must be active.`), { statusCode: 409 });
      }
      if (idKey(location.warehouse) !== idKey(warehouseId)) {
        throw Object.assign(new Error(`${label}: location does not belong to the selected warehouse.`), { statusCode: 409 });
      }
    }

    const stock = stockMap.get(positionKey(line.product, line.location));
    const systemQuantity = roundQuantity(stock?.onHandQuantity || 0);
    let countedQuantity;
    let varianceQuantity;

    if (mode === "count") {
      if (!Number.isFinite(line.countedQuantity) || line.countedQuantity < 0) {
        throw Object.assign(new Error(`${label}: counted quantity must be a valid non-negative number.`), { statusCode: 400 });
      }
      countedQuantity = roundQuantity(line.countedQuantity);
      varianceQuantity = roundQuantity(countedQuantity - systemQuantity);
    } else {
      if (!Number.isFinite(line.varianceQuantity)) {
        throw Object.assign(new Error(`${label}: variance quantity must be a valid number.`), { statusCode: 400 });
      }
      varianceQuantity = roundQuantity(line.varianceQuantity);
      countedQuantity = roundQuantity(systemQuantity + varianceQuantity);
      if (countedQuantity < 0) {
        throw Object.assign(
          new Error(`${label}: adjustment would create negative stock. Negative inventory requires negative stock GL variance accounting which is currently disabled.`),
          { statusCode: 409 }
        );
      }
    }

    const unitCost = roundMoney(
      Number.isFinite(line.unitCost) && line.unitCost >= 0
        ? line.unitCost
        : stock?.averageCost || product.purchasePrice || 0
    );
    const absoluteVariance = Math.abs(varianceQuantity);
    const serialNumbers = sanitizeSerialNumbers(line.serialNumbers);
    const lotNumber = clean(line.lotNumber).toUpperCase();

    if (absoluteVariance > 0 && product.trackingType === "batch" && !lotNumber) {
      throw Object.assign(new Error(`${label}: lot number is required for this batch-tracked product.`), { statusCode: 400 });
    }
    if (absoluteVariance > 0 && product.trackingType === "serial") {
      if (!Number.isInteger(absoluteVariance)) {
        throw Object.assign(new Error(`${label}: serial-tracked variance must be a whole number.`), { statusCode: 400 });
      }
      if (serialNumbers.length !== absoluteVariance) {
        throw Object.assign(new Error(`${label}: provide one unique serial number for each adjusted unit.`), { statusCode: 400 });
      }
    }

    return {
      product: line.product,
      location: line.location || null,
      systemQuantity,
      countedQuantity,
      varianceQuantity,
      unitCost,
      varianceValue: roundMoney(varianceQuantity * unitCost),
      stockVersion: Number(stock?.stockVersion || 0),
      lotNumber,
      serialNumbers,
      note: clean(line.note),
    };
  });
};

const validateFreshness = async (adjustment, { tenantId = null, session = null } = {}) => {
  const query = ProductStock.find({ ...buildStockQuery(adjustment.warehouse, adjustment.lines), ...(tenantId ? { tenantId } : {}) })
    .select("product location onHandQuantity stockVersion")
    .lean();
  if (session) query.session(session);
  const stocks = await query;
  const stockMap = new Map(stocks.map((item) => [positionKey(item.product, item.location), item]));
  const staleLines = [];

  for (const line of adjustment.lines) {
    const current = stockMap.get(positionKey(line.product, line.location));
    const currentQuantity = roundQuantity(current?.onHandQuantity || 0);
    const currentVersion = Number(current?.stockVersion || 0);
    if (currentVersion !== Number(line.stockVersion || 0) || currentQuantity !== roundQuantity(line.systemQuantity)) {
      staleLines.push({
        lineId: line._id,
        product: line.product,
        location: line.location || null,
        snapshotQuantity: line.systemQuantity,
        currentQuantity,
        snapshotVersion: line.stockVersion,
        currentVersion,
      });
    }
  }

  if (staleLines.length) {
    const error = Object.assign(
      new Error("Stock changed after this adjustment was prepared. Refresh the adjustment before submitting or posting."),
      { statusCode: 409, staleLines }
    );
    throw error;
  }
};

const buildListFilter = (query = {}, tenantId = null) => {
  const filter = {};
  if (tenantId) filter.tenantId = new mongoose.Types.ObjectId(String(tenantId));
  if (query.status && query.status !== "all") filter.status = clean(query.status).toLowerCase();
  if (query.adjustmentType && query.adjustmentType !== "all") {
    filter.adjustmentType = clean(query.adjustmentType).toLowerCase();
  }
  if (query.adjustmentMode && query.adjustmentMode !== "all") {
    filter.adjustmentMode = clean(query.adjustmentMode).toLowerCase();
  }
  if (isId(query.warehouse)) filter.warehouse = new mongoose.Types.ObjectId(query.warehouse);
  if (isId(query.product)) filter.products = new mongoose.Types.ObjectId(query.product);
  if (isId(query.location)) filter.locations = new mongoose.Types.ObjectId(query.location);
  if (isId(query.createdBy)) filter.createdBy = new mongoose.Types.ObjectId(query.createdBy);

  const from = parseDate(query.from);
  const to = parseDate(query.to);
  if (from || to) {
    filter.adjustmentDate = {};
    if (from) filter.adjustmentDate.$gte = from;
    if (to) {
      const end = new Date(to);
      end.setUTCHours(23, 59, 59, 999);
      filter.adjustmentDate.$lte = end;
    }
  }

  const q = clean(query.q).toUpperCase();
  if (q) {
    const prefix = new RegExp(`^${escapeRegex(q)}`);
    filter.$or = [{ adjustmentNo: prefix }, { reference: prefix }];
  }
  return filter;
};

const populateAdjustment = (query) =>
  query
    .populate("warehouse", "name code status")
    .populate("lines.product", "name sku barcode trackingType baseUnit status")
    .populate("lines.location", "name code locationType status isQuarantine")
    .populate("submittedBy", "name email")
    .populate("approvedBy", "name email")
    .populate("rejectedBy", "name email")
    .populate("postedBy", "name email")
    .populate("createdBy", "name email")
    .populate("movement", "movementNo movementDate status totalQuantity totalValue")
    .populate("reversalMovement", "movementNo movementDate status totalQuantity totalValue");

export const listStockAdjustments = async (req, res) => {
  try {
    const limit = parseLimit(req.query.limit, 30, 100);
    const cursor = decodeCursor(req.query.cursor);
    if (req.query.cursor && !cursor) return res.status(400).json({ message: "Invalid pagination cursor." });

    const filter = buildListFilter(req.query, req.tenantId);
    if (cursor) {
      filter.$and = [
        ...(filter.$and || []),
        {
          $or: [
            { adjustmentDate: { $lt: cursor.date } },
            { adjustmentDate: cursor.date, _id: { $lt: cursor.id } },
          ],
        },
      ];
    }

    const adjustments = await StockAdjustment.find(filter)
      .select(LIST_FIELDS)
      .populate("warehouse", "name code status")
      .populate("products", "name sku barcode imageUrl status")
      .sort({ adjustmentDate: -1, _id: -1 })
      .limit(limit + 1)
      .maxTimeMS(5000)
      .lean();

    const hasMore = adjustments.length > limit;
    if (hasMore) adjustments.pop();
    const nextCursor = hasMore && adjustments.length ? encodeCursor(adjustments[adjustments.length - 1]) : null;
    return res.json({ count: adjustments.length, hasMore, nextCursor, adjustments });
  } catch (error) {
    return res.status(500).json({ message: "Failed to load stock adjustments.", error: error.message });
  }
};

export const getStockAdjustmentSummary = async (req, res) => {
  try {
    const filter = buildListFilter(req.query, req.tenantId);
    const summary = await StockAdjustment.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          adjustmentCount: { $sum: 1 },
          pendingCount: { $sum: { $cond: [{ $eq: ["$status", "pending_approval"] }, 1, 0] } },
          approvedCount: { $sum: { $cond: [{ $eq: ["$status", "approved"] }, 1, 0] } },
          postedCount: { $sum: { $cond: [{ $eq: ["$status", "posted"] }, 1, 0] } },
          increaseQuantity: { $sum: "$increaseQuantity" },
          decreaseQuantity: { $sum: "$decreaseQuantity" },
          netQuantity: { $sum: "$netQuantity" },
          netValue: { $sum: "$netValue" },
        },
      },
      { $project: { _id: 0 } },
    ]).option({ maxTimeMS: 5000 });

    return res.json({
      summary: summary[0] || {
        adjustmentCount: 0,
        pendingCount: 0,
        approvedCount: 0,
        postedCount: 0,
        increaseQuantity: 0,
        decreaseQuantity: 0,
        netQuantity: 0,
        netValue: 0,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to load adjustment summary.", error: error.message });
  }
};

export const getStockAdjustment = async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(400).json({ message: "Invalid stock adjustment ID." });
    const adjustment = await populateAdjustment(
      StockAdjustment.findOne({ _id: req.params.id, ...(req.tenantId ? { tenantId: req.tenantId } : {}) })
    ).maxTimeMS(5000).lean();
    if (!adjustment) return res.status(404).json({ message: "Stock adjustment not found." });
    return res.json({ adjustment });
  } catch (error) {
    return res.status(500).json({ message: "Failed to load stock adjustment.", error: error.message });
  }
};

export const createStockAdjustment = async (req, res) => {
  try {
    const userId = req.user?._id || null;
    const payload = buildAdjustmentPayload(req.body, userId);
    payload.adjustmentDate = payload.adjustmentDate || new Date();
    payload.adjustmentType = payload.adjustmentType || "physical_count";
    payload.adjustmentMode = payload.adjustmentMode || "count";
    payload.currency = payload.currency || "BDT";
    if (req.tenantId) payload.tenantId = req.tenantId;

    const errors = validatePayload(payload);
    if (errors.length) return res.status(400).json({ message: errors[0], errors });

    if (payload.idempotencyKey) {
      const existing = await StockAdjustment.findOne({
        idempotencyKey: payload.idempotencyKey,
        ...(req.tenantId ? { tenantId: req.tenantId } : {}),
      })
        .select(LIST_FIELDS)
        .lean();
      if (existing) return res.status(200).json({ message: "Stock adjustment request already exists.", adjustment: existing });
    }

    payload.lines = await resolveAdjustmentLines({
      tenantId: req.tenantId,
      warehouseId: payload.warehouse,
      mode: payload.adjustmentMode,
      lines: payload.lines,
    });

    const adjustment = await StockAdjustment.create({
      ...payload,
      status: "draft",
      createdBy: userId,
      updatedBy: userId,
    });
    return res.status(201).json({ message: "Stock adjustment draft created.", adjustment });
  } catch (error) {
    return sendWriteError(res, error, "Failed to create stock adjustment.");
  }
};

export const updateStockAdjustment = async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(400).json({ message: "Invalid stock adjustment ID." });
    const current = await StockAdjustment.findOne({ _id: req.params.id, ...(req.tenantId ? { tenantId: req.tenantId } : {}) });
    if (!current) return res.status(404).json({ message: "Stock adjustment not found." });
    if (!["draft", "rejected"].includes(current.status)) {
      return res.status(409).json({ message: "Only a draft or rejected adjustment can be edited." });
    }

    const payload = buildAdjustmentPayload(req.body, req.user?._id || null);
    const editableKeys = Object.keys(payload).filter((key) => key !== "updatedBy");
    if (!editableKeys.length) return res.status(400).json({ message: "No valid adjustment fields were provided." });
    const errors = validatePayload(payload, { partial: true });
    if (errors.length) return res.status(400).json({ message: errors[0], errors });

    const warehouseId = payload.warehouse ?? current.warehouse;
    const mode = payload.adjustmentMode ?? current.adjustmentMode;
    const sourceLines = payload.lines ?? current.lines.map((line) => ({
      product: line.product,
      location: line.location,
      countedQuantity: line.countedQuantity,
      varianceQuantity: line.varianceQuantity,
      unitCost: line.unitCost,
      lotNumber: line.lotNumber,
      serialNumbers: line.serialNumbers,
      note: line.note,
    }));

    payload.lines = await resolveAdjustmentLines({ tenantId: req.tenantId, warehouseId, mode, lines: sourceLines });
    payload.status = "draft";
    payload.rejectedAt = null;
    payload.rejectedBy = null;
    payload.rejectionReason = "";

    Object.assign(current, payload);
    await current.save();
    return res.json({ message: "Stock adjustment draft updated.", adjustment: current });
  } catch (error) {
    return sendWriteError(res, error, "Failed to update stock adjustment.");
  }
};

export const refreshStockAdjustment = async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(400).json({ message: "Invalid stock adjustment ID." });
    const adjustment = await StockAdjustment.findOne({ _id: req.params.id, ...(req.tenantId ? { tenantId: req.tenantId } : {}) });
    if (!adjustment) return res.status(404).json({ message: "Stock adjustment not found." });
    if (!["draft", "rejected"].includes(adjustment.status)) {
      return res.status(409).json({ message: "Only a draft or rejected adjustment can be refreshed." });
    }

    const sourceLines = adjustment.lines.map((line) => ({
      product: line.product,
      location: line.location,
      countedQuantity: line.countedQuantity,
      varianceQuantity: line.varianceQuantity,
      unitCost: line.unitCost,
      lotNumber: line.lotNumber,
      serialNumbers: line.serialNumbers,
      note: line.note,
    }));
    adjustment.lines = await resolveAdjustmentLines({
      tenantId: req.tenantId,
      warehouseId: adjustment.warehouse,
      mode: adjustment.adjustmentMode,
      lines: sourceLines,
    });
    adjustment.status = "draft";
    adjustment.rejectedAt = null;
    adjustment.rejectedBy = null;
    adjustment.rejectionReason = "";
    adjustment.updatedBy = req.user?._id || null;
    await adjustment.save();
    return res.json({ message: "Stock snapshot refreshed and variances recalculated.", adjustment });
  } catch (error) {
    return sendWriteError(res, error, "Failed to refresh stock adjustment.");
  }
};

export const submitStockAdjustment = async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(400).json({ message: "Invalid stock adjustment ID." });
    let adjustment;
    await runMongoTransaction(async (session) => {
      adjustment = await StockAdjustment.findOne({
        _id: req.params.id,
        status: "draft",
        ...(req.tenantId ? { tenantId: req.tenantId } : {}),
      }).session(session);
      if (!adjustment) throw Object.assign(new Error("Only a draft adjustment can be submitted."), { statusCode: 409 });
      const isCountAudit = ["physical_count", "cycle_count"].includes(adjustment.adjustmentType) || adjustment.adjustmentMode === "count";
      if (!isCountAudit && !adjustment.lines.some((line) => Number(line.varianceQuantity || 0) !== 0)) {
        throw Object.assign(new Error("The adjustment has no quantity variance to submit."), { statusCode: 409 });
      }
      await validateFreshness(adjustment, { tenantId: req.tenantId, session });
      adjustment.status = "pending_approval";
      adjustment.submittedAt = new Date();
      adjustment.submittedBy = req.user?._id || null;
      adjustment.updatedBy = req.user?._id || null;
      await adjustment.save({ session });
    });
    return res.json({ message: "Stock adjustment submitted for approval.", adjustment });
  } catch (error) {
    return sendWriteError(res, error, "Failed to submit stock adjustment.");
  }
};

export const approveStockAdjustment = async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(400).json({ message: "Invalid stock adjustment ID." });
    const adjustment = await StockAdjustment.findOne({
      _id: req.params.id,
      status: "pending_approval",
      ...(req.tenantId ? { tenantId: req.tenantId } : {}),
    });
    if (!adjustment) return res.status(409).json({ message: "Only a pending adjustment can be approved." });

    // Enterprise Control: Segregation of Duties
    const preference = req.tenantId
      ? await InventoryPreference.findOne({ tenantId: req.tenantId, key: "default" }).lean()
      : null;

    if (preference?.enforceSegregationOfDuties) {
      const threshold = Number(preference.sodThresholdAmount || 0);
      const varianceValue = Math.abs(Number(adjustment.totalCostVariance || adjustment.totalQuantityVariance || 0));
      if (threshold === 0 || varianceValue >= threshold) {
        if (adjustment.createdBy && req.user?._id && String(adjustment.createdBy) === String(req.user._id)) {
          return res.status(403).json({
            code: "CREATOR_CANNOT_APPROVE",
            message: "Segregation of duties violation: The creator of a stock adjustment cannot approve it.",
          });
        }
      }
    }

    adjustment.status = "approved";
    adjustment.approvedAt = new Date();
    adjustment.approvedBy = req.user?._id || null;
    adjustment.updatedBy = req.user?._id || null;
    await adjustment.save();

    if (req.user?._id) {
      await writeAudit({
        tenantId: req.tenantId || null,
        actorId: req.user._id,
        action: "approve",
        entityType: "StockAdjustment",
        entityId: adjustment._id,
        meta: { adjustmentNo: adjustment.adjustmentNo },
      });
    }

    return res.json({ message: "Stock adjustment approved.", adjustment });
  } catch (error) {
    return sendWriteError(res, error, "Failed to approve stock adjustment.");
  }
};

export const rejectStockAdjustment = async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(400).json({ message: "Invalid stock adjustment ID." });
    const reason = clean(req.body.reason);
    if (!reason) return res.status(400).json({ message: "Rejection reason is required." });
    const adjustment = await StockAdjustment.findOneAndUpdate(
      { _id: req.params.id, status: "pending_approval", ...(req.tenantId ? { tenantId: req.tenantId } : {}) },
      {
        status: "rejected",
        rejectedAt: new Date(),
        rejectedBy: req.user?._id || null,
        rejectionReason: reason,
        updatedBy: req.user?._id || null,
      },
      { new: true, runValidators: true }
    );
    if (!adjustment) return res.status(409).json({ message: "Only a pending adjustment can be rejected." });
    return res.json({ message: "Stock adjustment rejected.", adjustment });
  } catch (error) {
    return sendWriteError(res, error, "Failed to reject stock adjustment.");
  }
};

export const postStockAdjustment = async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(400).json({ message: "Invalid stock adjustment ID." });
    const userId = req.user?._id || null;
    let adjustment;
    let movement;
    let journalEntry;

    await runMongoTransaction(async (session) => {
      adjustment = await StockAdjustment.findOne({
        _id: req.params.id,
        status: "approved",
        ...(req.tenantId ? { tenantId: req.tenantId } : {}),
      }).session(session);
      if (!adjustment) throw Object.assign(new Error("Only an approved adjustment can be posted."), { statusCode: 409 });
      await validateFreshness(adjustment, { tenantId: req.tenantId, session });

      movement = await postStockAdjustmentMovement({
        tenantId: req.tenantId,
        adjustment,
        userId,
        session,
      });

      journalEntry = await postInventoryAdjustmentAccounting({
        document: adjustment,
        userId,
        session,
      });

      adjustment.status = "posted";
      adjustment.movement = movement?._id || null;
      adjustment.journalEntry = journalEntry?._id || null;
      adjustment.postedAt = new Date();
      adjustment.postedBy = userId;
      adjustment.updatedBy = userId;
      await adjustment.save({ session });
    });

    const populated = await populateAdjustment(StockAdjustment.findById(adjustment._id)).lean();
    return res.json({ message: "Stock adjustment posted to inventory and the General Ledger.", adjustment: populated, movement, journalEntry });
  } catch (error) {
    return sendWriteError(res, error, "Failed to post stock adjustment.");
  }
};

export const reverseStockAdjustment = async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(400).json({ message: "Invalid stock adjustment ID." });
    const userId = req.user?._id || null;
    let adjustment;
    let reversal = null;
    let reversalJournalEntry;

    await runMongoTransaction(async (session) => {
      adjustment = await StockAdjustment.findOne({
        _id: req.params.id,
        status: "posted",
        ...(req.tenantId ? { tenantId: req.tenantId } : {}),
      }).session(session);
      if (!adjustment) throw Object.assign(new Error("Only a posted adjustment can be reversed."), { statusCode: 409 });

      if (adjustment.movement) {
        reversal = await reverseStockAdjustmentMovement({
          tenantId: req.tenantId,
          adjustment,
          userId,
          reason: clean(req.body.reason) || `Reversal of ${adjustment.adjustmentNo}`,
          session,
        });
      }

      reversalJournalEntry = await reverseProcurementAccounting({
        sourceType: "inventory_adjustment",
        sourceId: adjustment._id,
        date: new Date(),
        reference: `REV-${adjustment.adjustmentNo}`,
        reason: clean(req.body.reason) || `Reversal of ${adjustment.adjustmentNo}`,
        userId,
        session,
      });
      adjustment.status = "reversed";
      adjustment.reversalMovement = reversal?._id || null;
      adjustment.reversalJournalEntry = reversalJournalEntry?._id || null;
      adjustment.reversedAt = new Date();
      adjustment.reversedBy = userId;
      adjustment.updatedBy = userId;
      await adjustment.save({ session });
    });

    const populated = await populateAdjustment(StockAdjustment.findById(adjustment._id)).lean();
    return res.status(201).json({
      message: "Stock adjustment reversed with a compensating movement.",
      adjustment: populated,
      movement: reversal,
      reversalJournalEntry,
    });
  } catch (error) {
    return sendWriteError(res, error, "Failed to reverse stock adjustment.");
  }
};

export const cancelStockAdjustment = async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(400).json({ message: "Invalid stock adjustment ID." });
    const reason = clean(req.body.reason);
    if (!reason) return res.status(400).json({ message: "Cancellation reason is required." });
    const adjustment = await StockAdjustment.findOneAndUpdate(
      {
        _id: req.params.id,
        status: { $in: ["draft", "pending_approval", "approved", "rejected"] },
        movement: null,
        ...(req.tenantId ? { tenantId: req.tenantId } : {}),
      },
      {
        status: "cancelled",
        cancelledAt: new Date(),
        cancelledBy: req.user?._id || null,
        cancellationReason: reason,
        updatedBy: req.user?._id || null,
      },
      { new: true, runValidators: true }
    ).select(LIST_FIELDS);
    if (!adjustment) return res.status(409).json({ message: "This adjustment can no longer be cancelled." });
    return res.json({ message: "Stock adjustment cancelled.", adjustment });
  } catch (error) {
    return sendWriteError(res, error, "Failed to cancel stock adjustment.");
  }
};

export const deleteStockAdjustment = async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(400).json({ message: "Invalid stock adjustment ID." });
    const adjustment = await StockAdjustment.findOneAndDelete({
      _id: req.params.id,
      status: { $in: ["draft", "rejected", "cancelled"] },
      movement: null,
      ...(req.tenantId ? { tenantId: req.tenantId } : {}),
    });
    if (!adjustment) {
      return res.status(409).json({ message: "Only an unposted draft, rejected, or cancelled adjustment can be deleted." });
    }
    return res.json({ message: "Stock adjustment deleted." });
  } catch (error) {
    return res.status(500).json({ message: "Failed to delete stock adjustment.", error: error.message });
  }
};

export { ADJUSTMENT_TYPES, ADJUSTMENT_MODES, ADJUSTMENT_STATUSES };
