import mongoose from "mongoose";
import StockMovement, {
  MOVEMENT_STATUSES,
  MOVEMENT_TYPES,
  STOCK_EFFECTS,
} from "../../models/inventory/stockMovement.model.js";
import { runMongoTransaction } from "../../utils/mongoTransaction.js";

const LIST_FIELDS = [
  "movementNo",
  "movementDate",
  "movementType",
  "status",
  "reference",
  "sourceType",
  "sourceId",
  "currency",
  "reason",
  "products",
  "sourceWarehouses",
  "destinationWarehouses",
  "lineCount",
  "totalQuantity",
  "totalValue",
  "postedAt",
  "postedBy",
  "reversalOf",
  "reversedBy",
  "createdBy",
  "updatedAt",
].join(" ");

const clean = (value) => String(value ?? "").trim();
const isId = (value) => mongoose.Types.ObjectId.isValid(String(value || ""));
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

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

const encodeCursor = (movement) =>
  Buffer.from(
    JSON.stringify({ d: new Date(movement.movementDate).toISOString(), id: String(movement._id) }),
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

const sanitizeSerialNumbers = (values) => {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.map((value) => clean(value).toUpperCase()).filter(Boolean))];
};

const buildLinePayload = (line = {}) => ({
  product: nullableId(line.product),
  effect: clean(line.effect).toLowerCase(),
  sourceWarehouse: nullableId(line.sourceWarehouse),
  sourceLocation: nullableId(line.sourceLocation),
  destinationWarehouse: nullableId(line.destinationWarehouse),
  destinationLocation: nullableId(line.destinationLocation),
  quantity: parseNumber(line.quantity),
  requestedUnitCost: parseNumber(line.requestedUnitCost ?? line.unitCost) ?? 0,
  lotNumber: clean(line.lotNumber).toUpperCase(),
  serialNumbers: sanitizeSerialNumbers(line.serialNumbers),
  manufactureDate: line.manufactureDate ? parseDate(line.manufactureDate) : null,
  expiryDate: line.expiryDate ? parseDate(line.expiryDate) : null,
  note: clean(line.note),
});

const buildMovementPayload = (body = {}, userId = null) => {
  const payload = {};
  if (body.movementDate !== undefined) payload.movementDate = parseDate(body.movementDate);
  if (body.movementType !== undefined) payload.movementType = clean(body.movementType).toLowerCase();
  if (body.reference !== undefined) payload.reference = clean(body.reference).toUpperCase();
  if (body.sourceType !== undefined) payload.sourceType = clean(body.sourceType || "manual").toLowerCase();
  if (body.sourceId !== undefined) payload.sourceId = nullableId(body.sourceId);
  if (body.idempotencyKey !== undefined) payload.idempotencyKey = clean(body.idempotencyKey);
  if (body.currency !== undefined) payload.currency = clean(body.currency || "BDT").toUpperCase();
  if (body.reason !== undefined) payload.reason = clean(body.reason);
  if (body.notes !== undefined) payload.notes = clean(body.notes);
  if (body.lines !== undefined) payload.lines = Array.isArray(body.lines) ? body.lines.map(buildLinePayload) : undefined;
  if (userId) payload.updatedBy = userId;
  return payload;
};

const validatePayload = (payload, { partial = false } = {}) => {
  const errors = [];
  if ((!partial || payload.movementDate !== undefined) && !payload.movementDate) {
    errors.push("A valid movement date is required.");
  }
  if ((!partial || payload.movementType !== undefined) && !MOVEMENT_TYPES.includes(payload.movementType)) {
    errors.push("Movement type has an invalid value.");
  }
  if (payload.sourceId === undefined) errors.push("Source ID must be valid or empty.");
  if ((!partial || payload.lines !== undefined) && (!Array.isArray(payload.lines) || !payload.lines.length)) {
    errors.push("At least one movement line is required.");
  }
  if (Array.isArray(payload.lines) && payload.lines.length > 500) {
    errors.push("A movement cannot contain more than 500 lines.");
  }
  for (let index = 0; index < (payload.lines || []).length; index += 1) {
    const line = payload.lines[index];
    const label = `Line ${index + 1}`;
    if (!line.product) errors.push(`${label}: product is required.`);
    if (!STOCK_EFFECTS.includes(line.effect)) errors.push(`${label}: stock effect is invalid.`);
    if (!Number.isFinite(line.quantity) || line.quantity <= 0) errors.push(`${label}: quantity must be greater than zero.`);
    if (!Number.isFinite(line.requestedUnitCost) || line.requestedUnitCost < 0) {
      errors.push(`${label}: unit cost must be a valid non-negative number.`);
    }
    if (line.sourceWarehouse === undefined || line.sourceLocation === undefined) {
      errors.push(`${label}: source warehouse or location is invalid.`);
    }
    if (line.destinationWarehouse === undefined || line.destinationLocation === undefined) {
      errors.push(`${label}: destination warehouse or location is invalid.`);
    }
    if (line.manufactureDate === null && payload.lines[index]?.manufactureDate) {
      errors.push(`${label}: manufacture date is invalid.`);
    }
    if (line.expiryDate === null && payload.lines[index]?.expiryDate) {
      errors.push(`${label}: expiry date is invalid.`);
    }
  }
  return errors;
};

const duplicateMessage = (error) => {
  const field = Object.keys(error?.keyPattern || error?.keyValue || {})[0];
  if (field === "idempotencyKey") return "This stock movement request was already processed.";
  if (field === "movementNo") return "A stock movement with this number already exists.";
  if (field === "reversalOf") return "This stock movement has already been reversed.";
  return "A duplicate stock movement already exists.";
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
  if (query.movementType && query.movementType !== "all") {
    filter.movementType = clean(query.movementType).toLowerCase();
  }
  if (query.sourceType && query.sourceType !== "all") filter.sourceType = clean(query.sourceType).toLowerCase();
  if (isId(query.sourceId)) filter.sourceId = new mongoose.Types.ObjectId(query.sourceId);
  if (isId(query.product)) filter.products = new mongoose.Types.ObjectId(query.product);
  if (isId(query.warehouse)) {
    const warehouseId = new mongoose.Types.ObjectId(query.warehouse);
    filter.$or = [{ sourceWarehouses: warehouseId }, { destinationWarehouses: warehouseId }];
  }
  if (isId(query.createdBy)) filter.createdBy = new mongoose.Types.ObjectId(query.createdBy);

  const from = parseDate(query.from);
  const to = parseDate(query.to);
  if (from || to) {
    filter.movementDate = {};
    if (from) filter.movementDate.$gte = from;
    if (to) {
      const end = new Date(to);
      end.setUTCHours(23, 59, 59, 999);
      filter.movementDate.$lte = end;
    }
  }

  const q = clean(query.q).toUpperCase();
  if (q) {
    const prefix = new RegExp(`^${escapeRegex(q)}`);
    const search = [{ movementNo: prefix }, { reference: prefix }];
    if (filter.$or) filter.$and = [{ $or: filter.$or }, { $or: search }], delete filter.$or;
    else filter.$or = search;
  }
  return filter;
};

const populateMovement = (query) =>
  query
    .populate("lines.product", "name sku barcode trackingType baseUnit status")
    .populate("lines.sourceWarehouse", "name code status")
    .populate("lines.sourceLocation", "name code locationType status isQuarantine")
    .populate("lines.destinationWarehouse", "name code status")
    .populate("lines.destinationLocation", "name code locationType status isQuarantine")
    .populate("postedBy", "name email")
    .populate("createdBy", "name email")
    .populate("reversalOf", "movementNo movementDate status")
    .populate("reversedBy", "movementNo movementDate status");

export const listStockMovements = async (req, res) => {
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
            { movementDate: { $lt: cursor.date } },
            { movementDate: cursor.date, _id: { $lt: cursor.id } },
          ],
        },
      ];
    }

    const movements = await StockMovement.find(filter)
      .select(LIST_FIELDS)
      .populate("products", "name sku barcode imageUrl status")
      .populate("sourceWarehouses", "name code status")
      .populate("destinationWarehouses", "name code status")
      .sort({ movementDate: -1, _id: -1 })
      .limit(limit + 1)
      .maxTimeMS(5000)
      .lean();

    const hasMore = movements.length > limit;
    if (hasMore) movements.pop();
    const nextCursor = hasMore && movements.length ? encodeCursor(movements[movements.length - 1]) : null;
    return res.json({ count: movements.length, hasMore, nextCursor, movements });
  } catch (error) {
    return res.status(500).json({ message: "Failed to load stock movements.", error: error.message });
  }
};

export const getStockMovementSummary = async (req, res) => {
  try {
    const filter = buildListFilter(req.query);
    const summary = await StockMovement.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          movementCount: { $sum: 1 },
          postedCount: { $sum: { $cond: [{ $eq: ["$status", "posted"] }, 1, 0] } },
          draftCount: { $sum: { $cond: [{ $eq: ["$status", "draft"] }, 1, 0] } },
          reversedCount: { $sum: { $cond: [{ $eq: ["$status", "reversed"] }, 1, 0] } },
          totalQuantity: { $sum: "$totalQuantity" },
          totalValue: { $sum: "$totalValue" },
        },
      },
      { $project: { _id: 0 } },
    ]).option({ maxTimeMS: 5000 });

    return res.json({
      summary: summary[0] || {
        movementCount: 0,
        postedCount: 0,
        draftCount: 0,
        reversedCount: 0,
        totalQuantity: 0,
        totalValue: 0,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to load movement summary.", error: error.message });
  }
};

export const getStockMovement = async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(400).json({ message: "Invalid stock movement ID." });
    const movement = await populateMovement(StockMovement.findById(req.params.id)).maxTimeMS(5000).lean();
    if (!movement) return res.status(404).json({ message: "Stock movement not found." });
    return res.json({ movement });
  } catch (error) {
    return res.status(500).json({ message: "Failed to load stock movement.", error: error.message });
  }
};

export const createStockMovement = async (req, res) => {
  try {
    const userId = req.user?._id || null;
    const payload = buildMovementPayload(req.body, userId);
    payload.movementDate = payload.movementDate || new Date();
    payload.movementType = payload.movementType || "other";
    payload.sourceType = payload.sourceType || "manual";
    payload.currency = payload.currency || "BDT";

    const errors = validatePayload(payload);
    if (errors.length) return res.status(400).json({ message: errors[0], errors });

    if (payload.idempotencyKey) {
      const existing = await StockMovement.findOne({ idempotencyKey: payload.idempotencyKey }).select(LIST_FIELDS).lean();
      if (existing) return res.status(200).json({ message: "Stock movement request already exists.", movement: existing });
    }

    await StockMovement.validateDraftLines(payload.lines);
    const movement = await StockMovement.create({
      ...payload,
      status: "draft",
      createdBy: userId,
      updatedBy: userId,
    });
    return res.status(201).json({ message: "Stock movement draft created.", movement });
  } catch (error) {
    return sendWriteError(res, error, "Failed to create stock movement.");
  }
};

export const createAndPostStockMovement = async (req, res) => {
  try {
    const userId = req.user?._id || null;
    const payload = buildMovementPayload(req.body, userId);
    payload.movementDate = payload.movementDate || new Date();
    payload.movementType = payload.movementType || "other";
    payload.sourceType = payload.sourceType || "manual";
    payload.currency = payload.currency || "BDT";

    const errors = validatePayload(payload);
    if (errors.length) return res.status(400).json({ message: errors[0], errors });

    let movement;
    await runMongoTransaction(async (session) => {
      if (payload.idempotencyKey) {
        const existing = await StockMovement.findOne({ idempotencyKey: payload.idempotencyKey }).session(session);
        if (existing) {
          movement = existing.status === "draft"
            ? await StockMovement.postMovementDocument({ movementId: existing._id, userId, session })
            : existing;
          return;
        }
      }

      await StockMovement.validateDraftLines(payload.lines, { session });
      movement = new StockMovement({
        ...payload,
        status: "draft",
        createdBy: userId,
        updatedBy: userId,
      });
      await movement.save({ session });
      movement = await StockMovement.postMovementDocument({ movementId: movement._id, userId, session });
    });

    const populated = await populateMovement(StockMovement.findById(movement._id)).lean();
    return res.status(201).json({ message: "Stock movement posted.", movement: populated });
  } catch (error) {
    return sendWriteError(res, error, "Failed to create and post stock movement.");
  }
};

export const updateStockMovement = async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(400).json({ message: "Invalid stock movement ID." });
    const payload = buildMovementPayload(req.body, req.user?._id || null);
    const editableKeys = Object.keys(payload).filter((key) => key !== "updatedBy");
    if (!editableKeys.length) return res.status(400).json({ message: "No valid movement fields were provided." });

    const errors = validatePayload(payload, { partial: true });
    if (errors.length) return res.status(400).json({ message: errors[0], errors });
    if (payload.lines) await StockMovement.validateDraftLines(payload.lines);

    const movement = await StockMovement.findOne({ _id: req.params.id, status: "draft" });
    if (!movement) return res.status(409).json({ message: "Only an existing draft movement can be updated." });
    Object.assign(movement, payload);
    await movement.save();
    return res.json({ message: "Stock movement draft updated.", movement });
  } catch (error) {
    return sendWriteError(res, error, "Failed to update stock movement.");
  }
};

export const postStockMovement = async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(400).json({ message: "Invalid stock movement ID." });
    let movement;
    await runMongoTransaction(async (session) => {
      movement = await StockMovement.postMovementDocument({
        movementId: req.params.id,
        userId: req.user?._id || null,
        session,
      });
    });
    const populated = await populateMovement(StockMovement.findById(movement._id)).lean();
    return res.json({ message: "Stock movement posted.", movement: populated });
  } catch (error) {
    return sendWriteError(res, error, "Failed to post stock movement.");
  }
};

export const reverseStockMovement = async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(400).json({ message: "Invalid stock movement ID." });
    let reversal;
    await runMongoTransaction(async (session) => {
      reversal = await StockMovement.reverseMovementDocument({
        movementId: req.params.id,
        userId: req.user?._id || null,
        reason: clean(req.body.reason),
        session,
      });
    });
    const populated = await populateMovement(StockMovement.findById(reversal._id)).lean();
    return res.status(201).json({ message: "Stock movement reversed with a compensating entry.", movement: populated });
  } catch (error) {
    return sendWriteError(res, error, "Failed to reverse stock movement.");
  }
};

export const cancelStockMovement = async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(400).json({ message: "Invalid stock movement ID." });
    const reason = clean(req.body.reason);
    if (!reason) return res.status(400).json({ message: "Cancellation reason is required." });

    const movement = await StockMovement.findOneAndUpdate(
      { _id: req.params.id, status: "draft" },
      {
        status: "cancelled",
        cancellationReason: reason,
        cancelledAt: new Date(),
        cancelledBy: req.user?._id || null,
        updatedBy: req.user?._id || null,
      },
      { new: true, runValidators: true }
    ).select(LIST_FIELDS);
    if (!movement) return res.status(409).json({ message: "Only a draft movement can be cancelled." });
    return res.json({ message: "Stock movement cancelled.", movement });
  } catch (error) {
    return sendWriteError(res, error, "Failed to cancel stock movement.");
  }
};

export const deleteStockMovement = async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(400).json({ message: "Invalid stock movement ID." });
    const movement = await StockMovement.findOneAndDelete({
      _id: req.params.id,
      status: { $in: ["draft", "cancelled"] },
      reversalOf: null,
    });
    if (!movement) {
      return res.status(409).json({ message: "Only a draft or cancelled non-reversal movement can be deleted." });
    }
    return res.json({ message: "Stock movement draft deleted." });
  } catch (error) {
    return res.status(500).json({ message: "Failed to delete stock movement.", error: error.message });
  }
};

export { MOVEMENT_TYPES, MOVEMENT_STATUSES, STOCK_EFFECTS };
