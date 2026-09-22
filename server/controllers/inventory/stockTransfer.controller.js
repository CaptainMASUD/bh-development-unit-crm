import mongoose from "mongoose";
import { assignDocumentNumber } from "../../services/administration/documentNumbering.service.js";
import Product from "../../models/inventory/product.model.js";
import Warehouse from "../../models/inventory/warehouse.model.js";
import WarehouseLocation from "../../models/inventory/warehouseLocation.model.js";
import StockMovement from "../../models/inventory/stockMovement.model.js";
import StockTransfer, {
  TRANSFER_MODES,
  TRANSFER_STATUSES,
} from "../../models/inventory/stockTransfer.model.js";
import { roundMoney, roundQuantity } from "../../models/inventory/productStock.model.js";
import { runMongoTransaction } from "../../utils/mongoTransaction.js";
import {
  dispatchTransferStock,
  receiveTransferStock,
  postDirectTransferStock,
  closeShortTransferStock,
} from "../../services/inventoryPosting.service.js";
import { InventoryPreference } from "../../models/inventory/inventoryOperations.model.js";
import { writeAudit } from "../../utils/audit.js";

const LIST_FIELDS = [
  "transferNo",
  "transferDate",
  "expectedDeliveryDate",
  "transferMode",
  "status",
  "sourceWarehouse",
  "destinationWarehouse",
  "reference",
  "currency",
  "reason",
  "products",
  "lineCount",
  "totalRequestedQuantity",
  "totalApprovedQuantity",
  "totalDispatchedQuantity",
  "totalReceivedQuantity",
  "totalShortQuantity",
  "totalValue",
  "submittedAt",
  "approvedAt",
  "dispatchedAt",
  "receivedAt",
  "closedAt",
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

const parseQuantity = (value) => {
  if (value === "" || value === null || value === undefined) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? roundQuantity(parsed) : Number.NaN;
};

const nullableId = (value) => {
  const normalized = clean(value);
  if (!normalized) return null;
  return isId(normalized) ? normalized : undefined;
};

const normalizeSerials = (values = []) => {
  const seen = new Set();
  const result = [];
  for (const raw of Array.isArray(values) ? values : []) {
    const value = clean(raw).toUpperCase();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    result.push(value);
  }
  return result;
};

const encodeCursor = (transfer) =>
  Buffer.from(
    JSON.stringify({ d: new Date(transfer.transferDate).toISOString(), id: String(transfer._id) }),
    "utf8"
  ).toString("base64url");

const decodeCursor = (value) => {
  try {
    if (!value) return null;
    const parsed = JSON.parse(Buffer.from(String(value), "base64url").toString("utf8"));
    const date = new Date(parsed?.d);
    if (Number.isNaN(date.getTime()) || !isId(parsed?.id)) return null;
    return { date, id: new mongoose.Types.ObjectId(parsed.id) };
  } catch {
    return null;
  }
};

const buildTransferLine = (line = {}) => ({
  ...(isId(line._id) ? { _id: line._id } : {}),
  product: clean(line.product),
  sourceLocation: nullableId(line.sourceLocation),
  destinationLocation: nullableId(line.destinationLocation),
  requestedQuantity: parseQuantity(line.requestedQuantity),
  approvedQuantity: 0,
  dispatchedQuantity: 0,
  receivedQuantity: 0,
  shortQuantity: 0,
  unitCost: roundMoney(line.unitCost),
  lotNumber: clean(line.lotNumber).toUpperCase(),
  serialNumbers: normalizeSerials(line.serialNumbers),
  receivedSerialNumbers: normalizeSerials(line.receivedSerialNumbers),
  manufactureDate: parseDate(line.manufactureDate),
  expiryDate: parseDate(line.expiryDate),
  note: clean(line.note),
});

const buildTransferPayload = (body = {}, userId = null) => {
  const payload = {};
  if (body.transferDate !== undefined) payload.transferDate = parseDate(body.transferDate);
  if (body.expectedDeliveryDate !== undefined) payload.expectedDeliveryDate = parseDate(body.expectedDeliveryDate);
  if (body.transferMode !== undefined) payload.transferMode = clean(body.transferMode).toLowerCase();
  if (body.sourceWarehouse !== undefined) payload.sourceWarehouse = clean(body.sourceWarehouse);
  if (body.destinationWarehouse !== undefined) payload.destinationWarehouse = clean(body.destinationWarehouse);
  if (body.reference !== undefined) payload.reference = clean(body.reference).toUpperCase();
  if (body.externalReference !== undefined) payload.externalReference = clean(body.externalReference);
  if (body.clientRequestId !== undefined) payload.clientRequestId = clean(body.clientRequestId);
  if (body.currency !== undefined) payload.currency = clean(body.currency || "BDT").toUpperCase();
  if (body.reason !== undefined) payload.reason = clean(body.reason);
  if (body.notes !== undefined) payload.notes = clean(body.notes);
  if (body.lines !== undefined) payload.lines = Array.isArray(body.lines) ? body.lines.map(buildTransferLine) : [];
  if (userId) payload.updatedBy = userId;
  return payload;
};

const sendWriteError = (res, error, fallback) => {
  if (error?.code === 11000) {
    const field = Object.keys(error.keyPattern || error.keyValue || {})[0];
    return res.status(409).json({
      message:
        field === "clientRequestId"
          ? "A transfer with this client request ID already exists."
          : "A stock transfer with the same unique value already exists.",
      error: error.message,
    });
  }
  if (["ValidationError", "CastError"].includes(error?.name)) {
    return res.status(400).json({ message: error.message, error: error.message });
  }
  return res.status(error?.statusCode || 500).json({
    message: error?.statusCode ? error.message : fallback,
    error: error.message,
  });
};

const populateTransfer = (query) =>
  query
    .populate("sourceWarehouse", "name code warehouseType status")
    .populate("destinationWarehouse", "name code warehouseType status")
    .populate("lines.product", "name sku barcode trackingType baseUnit status")
    .populate("lines.sourceLocation", "name code locationType status")
    .populate("lines.destinationLocation", "name code locationType status")
    .populate("directMovement", "movementNo movementDate status totalQuantity totalValue")
    .populate("dispatchMovement", "movementNo movementDate status totalQuantity totalValue")
    .populate("receipts.movement", "movementNo movementDate status totalQuantity totalValue")
    .populate("closeMovement", "movementNo movementDate status totalQuantity")
    .populate("createdBy", "name email")
    .populate("submittedBy", "name email")
    .populate("approvedBy", "name email")
    .populate("dispatchedBy", "name email")
    .populate("receivedBy", "name email");

const validateTransferPayload = async (payload, { tenantId = null, session = null } = {}) => {
  if (!isId(payload.sourceWarehouse)) {
    throw Object.assign(new Error("A valid source warehouse is required."), { statusCode: 400 });
  }
  if (!isId(payload.destinationWarehouse)) {
    throw Object.assign(new Error("A valid destination warehouse is required."), { statusCode: 400 });
  }
  if (!TRANSFER_MODES.includes(payload.transferMode || "two_step")) {
    throw Object.assign(new Error("Transfer mode must be direct or two_step."), { statusCode: 400 });
  }
  if (!payload.transferDate) {
    throw Object.assign(new Error("A valid transfer date is required."), { statusCode: 400 });
  }
  if (!Array.isArray(payload.lines) || !payload.lines.length || payload.lines.length > 500) {
    throw Object.assign(new Error("A stock transfer must contain between 1 and 500 lines."), { statusCode: 400 });
  }

  const productIds = [...new Set(payload.lines.map((line) => String(line.product || "")))];
  if (productIds.some((id) => !isId(id))) {
    throw Object.assign(new Error("Every transfer line must contain a valid product."), { statusCode: 400 });
  }

  for (let index = 0; index < payload.lines.length; index += 1) {
    const line = payload.lines[index];
    if (!Number.isFinite(line.requestedQuantity) || line.requestedQuantity <= 0) {
      throw Object.assign(new Error(`Line ${index + 1}: requested quantity must be greater than zero.`), { statusCode: 400 });
    }
    if (line.sourceLocation === undefined || line.destinationLocation === undefined) {
      throw Object.assign(new Error(`Line ${index + 1}: warehouse location ID is invalid.`), { statusCode: 400 });
    }
  }

  const warehouseQuery = Warehouse.find({
    _id: { $in: [payload.sourceWarehouse, payload.destinationWarehouse] },
    ...(tenantId ? { tenantId } : {}),
  })
    .select("name code status")
    .lean();
  const productQuery = Product.find({ _id: { $in: productIds }, ...(tenantId ? { tenantId } : {}) })
    .select("name sku status productType trackInventory trackingType purchasePrice")
    .lean();
  const locationIds = [
    ...new Set(
      payload.lines
        .flatMap((line) => [line.sourceLocation, line.destinationLocation])
        .filter(Boolean)
        .map(String)
    ),
  ];
  const locationQuery = locationIds.length
    ? WarehouseLocation.find({ _id: { $in: locationIds }, ...(tenantId ? { tenantId } : {}) })
        .select("warehouse name code status")
        .lean()
    : Promise.resolve([]);

  if (session) {
    warehouseQuery.session(session);
    productQuery.session(session);
    if (locationIds.length) locationQuery.session(session);
  }

  const [warehouses, products, locations] = await Promise.all([
    warehouseQuery,
    productQuery,
    locationQuery,
  ]);
  const warehouseMap = new Map(warehouses.map((item) => [String(item._id), item]));
  const productMap = new Map(products.map((item) => [String(item._id), item]));
  const locationMap = new Map(locations.map((item) => [String(item._id), item]));

  for (const warehouseId of [payload.sourceWarehouse, payload.destinationWarehouse]) {
    const warehouse = warehouseMap.get(String(warehouseId));
    if (!warehouse) throw Object.assign(new Error("Selected warehouse was not found."), { statusCode: 404 });
    if (warehouse.status !== "active") {
      throw Object.assign(new Error("Both source and destination warehouses must be active."), { statusCode: 409 });
    }
  }

  const duplicateKeys = new Set();
  for (let index = 0; index < payload.lines.length; index += 1) {
    const line = payload.lines[index];
    const product = productMap.get(String(line.product));
    if (!product) throw Object.assign(new Error(`Line ${index + 1}: product was not found.`), { statusCode: 404 });
    if (product.status !== "active" || product.productType !== "inventory" || product.trackInventory !== true) {
      throw Object.assign(new Error(`Line ${index + 1}: product must be active and inventory-tracked.`), { statusCode: 409 });
    }

    for (const [field, warehouseId] of [
      ["sourceLocation", payload.sourceWarehouse],
      ["destinationLocation", payload.destinationWarehouse],
    ]) {
      const locationId = line[field];
      if (!locationId) continue;
      const location = locationMap.get(String(locationId));
      if (!location) throw Object.assign(new Error(`Line ${index + 1}: warehouse location was not found.`), { statusCode: 404 });
      if (location.status !== "active") {
        throw Object.assign(new Error(`Line ${index + 1}: warehouse location must be active.`), { statusCode: 409 });
      }
      if (String(location.warehouse) !== String(warehouseId)) {
        throw Object.assign(new Error(`Line ${index + 1}: location does not belong to its warehouse.`), { statusCode: 409 });
      }
    }

    if (
      String(payload.sourceWarehouse) === String(payload.destinationWarehouse) &&
      String(line.sourceLocation || "") === String(line.destinationLocation || "")
    ) {
      throw Object.assign(new Error(`Line ${index + 1}: source and destination positions must be different.`), { statusCode: 409 });
    }

    if (product.trackingType === "batch" && !line.lotNumber) {
      throw Object.assign(new Error(`Line ${index + 1}: lot number is required for this batch-tracked product.`), { statusCode: 400 });
    }
    if (product.trackingType === "serial") {
      if (!Number.isInteger(line.requestedQuantity)) {
        throw Object.assign(new Error(`Line ${index + 1}: serial-tracked quantity must be a whole number.`), { statusCode: 400 });
      }
      if (line.serialNumbers.length !== line.requestedQuantity) {
        throw Object.assign(new Error(`Line ${index + 1}: provide one unique serial number per requested unit.`), { statusCode: 400 });
      }
    }

    const duplicateKey = [
      String(line.product),
      String(line.sourceLocation || "none"),
      String(line.destinationLocation || "none"),
      line.lotNumber || "none",
    ].join(":");
    if (duplicateKeys.has(duplicateKey)) {
      throw Object.assign(new Error(`Line ${index + 1}: duplicate product stock position.`), { statusCode: 409 });
    }
    duplicateKeys.add(duplicateKey);
  }

  return { productMap, warehouseMap, locationMap };
};

const buildListFilter = (query = {}, tenantId = null) => {
  const filter = {};
  if (tenantId) filter.tenantId = new mongoose.Types.ObjectId(String(tenantId));
  if (query.status && query.status !== "all") filter.status = clean(query.status).toLowerCase();
  if (query.transferMode && query.transferMode !== "all") filter.transferMode = clean(query.transferMode).toLowerCase();
  if (isId(query.sourceWarehouse)) filter.sourceWarehouse = query.sourceWarehouse;
  if (isId(query.destinationWarehouse)) filter.destinationWarehouse = query.destinationWarehouse;
  if (isId(query.product)) filter.products = query.product;
  const from = parseDate(query.from);
  const to = parseDate(query.to);
  if (from || to) {
    filter.transferDate = {};
    if (from) filter.transferDate.$gte = from;
    if (to) filter.transferDate.$lte = to;
  }
  const q = clean(query.q).toUpperCase();
  if (q) {
    const rx = new RegExp(`^${escapeRegex(q)}`);
    filter.$or = [{ transferNo: rx }, { reference: rx }];
  }
  return filter;
};

const createMovement = async ({ transfer, lines, idempotencyKey, reference, notes, userId, session }) => {
  const movementNo = (await assignDocumentNumber({ tenantId: transfer.tenantId, typeKey: "inventory.stock-movement", session, idempotencyKey, source: "inventory.stock-transfer.movement" })).value;
  const movement = new StockMovement({
    movementNo,
    movementDate: new Date(),
    movementType: "warehouse_transfer",
    status: "draft",
    reference: reference || transfer.transferNo,
    sourceType: "stock_transfer",
    sourceId: transfer._id,
    idempotencyKey,
    currency: transfer.currency,
    reason: transfer.reason || "Warehouse stock transfer",
    notes,
    lines,
    createdBy: userId,
    updatedBy: userId,
  });
  await movement.save({ session });
  await StockMovement.postMovementDocument({ movementId: movement._id, userId, session });
  return movement;
};

export const listStockTransfers = async (req, res) => {
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
            { transferDate: { $lt: cursor.date } },
            { transferDate: cursor.date, _id: { $lt: cursor.id } },
          ],
        },
      ];
    }

    const transfers = await StockTransfer.find(filter)
      .select(LIST_FIELDS)
      .populate("sourceWarehouse", "name code status")
      .populate("destinationWarehouse", "name code status")
      .populate("products", "name sku barcode imageUrl status")
      .sort({ transferDate: -1, _id: -1 })
      .limit(limit + 1)
      .maxTimeMS(5000)
      .lean();

    const hasMore = transfers.length > limit;
    if (hasMore) transfers.pop();
    const nextCursor = hasMore && transfers.length ? encodeCursor(transfers[transfers.length - 1]) : null;
    return res.json({ count: transfers.length, hasMore, nextCursor, transfers });
  } catch (error) {
    return res.status(500).json({ message: "Failed to load stock transfers.", error: error.message });
  }
};

export const getStockTransferSummary = async (req, res) => {
  try {
    const match = buildListFilter(req.query, req.tenantId);
    delete match.$or;
    const [summary] = await StockTransfer.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          totalTransfers: { $sum: 1 },
          draft: { $sum: { $cond: [{ $eq: ["$status", "draft"] }, 1, 0] } },
          awaitingApproval: { $sum: { $cond: [{ $eq: ["$status", "submitted"] }, 1, 0] } },
          inTransit: {
            $sum: { $cond: [{ $in: ["$status", ["dispatched", "partially_received"]] }, 1, 0] },
          },
          received: { $sum: { $cond: [{ $eq: ["$status", "received"] }, 1, 0] } },
          requestedQuantity: { $sum: "$totalRequestedQuantity" },
          dispatchedQuantity: { $sum: "$totalDispatchedQuantity" },
          receivedQuantity: { $sum: "$totalReceivedQuantity" },
          shortQuantity: { $sum: "$totalShortQuantity" },
          transferValue: { $sum: "$totalValue" },
        },
      },
      { $project: { _id: 0 } },
    ]).option({ maxTimeMS: 5000 });

    return res.json({
      summary: summary || {
        totalTransfers: 0,
        draft: 0,
        awaitingApproval: 0,
        inTransit: 0,
        received: 0,
        requestedQuantity: 0,
        dispatchedQuantity: 0,
        receivedQuantity: 0,
        shortQuantity: 0,
        transferValue: 0,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to load transfer summary.", error: error.message });
  }
};

export const getStockTransfer = async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(400).json({ message: "Invalid stock transfer ID." });
    const transfer = await populateTransfer(
      StockTransfer.findOne({ _id: req.params.id, ...(req.tenantId ? { tenantId: req.tenantId } : {}) })
    ).lean();
    if (!transfer) return res.status(404).json({ message: "Stock transfer not found." });
    return res.json({ transfer });
  } catch (error) {
    return res.status(500).json({ message: "Failed to load stock transfer.", error: error.message });
  }
};

export const createStockTransfer = async (req, res) => {
  try {
    const userId = req.user?._id || null;
    const payload = buildTransferPayload(req.body, userId);
    payload.transferMode = payload.transferMode || "two_step";
    payload.transferDate = payload.transferDate || new Date();
    payload.currency = payload.currency || "BDT";
    if (req.tenantId) payload.tenantId = req.tenantId;
    await validateTransferPayload(payload, { tenantId: req.tenantId });
    payload.transferNo = (await assignDocumentNumber({
      tenantId: req.tenantId, typeKey: "inventory.stock-transfer",
      providedValue: payload.transferNo, idempotencyKey: payload.clientRequestId,
      source: "inventory.stock-transfer.create",
    })).value;

    const transfer = await StockTransfer.create({
      ...payload,
      status: "draft",
      createdBy: userId,
      updatedBy: userId,
    });
    return res.status(201).json({ message: "Stock transfer created.", transfer });
  } catch (error) {
    return sendWriteError(res, error, "Failed to create stock transfer.");
  }
};

export const updateStockTransfer = async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(400).json({ message: "Invalid stock transfer ID." });
    const userId = req.user?._id || null;
    const current = await StockTransfer.findOne({ _id: req.params.id, status: "draft", ...(req.tenantId ? { tenantId: req.tenantId } : {}) });
    if (!current) return res.status(409).json({ message: "Only a draft stock transfer can be updated." });

    const patch = buildTransferPayload(req.body, userId);
    const merged = {
      transferDate: patch.transferDate ?? current.transferDate,
      expectedDeliveryDate: patch.expectedDeliveryDate ?? current.expectedDeliveryDate,
      transferMode: patch.transferMode ?? current.transferMode,
      sourceWarehouse: patch.sourceWarehouse ?? current.sourceWarehouse,
      destinationWarehouse: patch.destinationWarehouse ?? current.destinationWarehouse,
      lines: patch.lines ?? current.lines.map((line) => line.toObject()),
    };
    await validateTransferPayload(merged, { tenantId: req.tenantId });
    current.set(patch);
    current.updatedBy = userId;
    await current.save();
    return res.json({ message: "Stock transfer updated.", transfer: current });
  } catch (error) {
    return sendWriteError(res, error, "Failed to update stock transfer.");
  }
};

export const submitStockTransfer = async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(400).json({ message: "Invalid stock transfer ID." });
    const transfer = await StockTransfer.findOneAndUpdate(
      { _id: req.params.id, status: "draft", ...(req.tenantId ? { tenantId: req.tenantId } : {}) },
      {
        status: "submitted",
        submittedAt: new Date(),
        submittedBy: req.user?._id || null,
        updatedBy: req.user?._id || null,
      },
      { new: true, runValidators: true }
    );
    if (!transfer) return res.status(409).json({ message: "Only a draft transfer can be submitted." });
    return res.json({ message: "Stock transfer submitted for approval.", transfer });
  } catch (error) {
    return sendWriteError(res, error, "Failed to submit stock transfer.");
  }
};

export const approveStockTransfer = async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(400).json({ message: "Invalid stock transfer ID." });
    const transfer = await StockTransfer.findOne({ _id: req.params.id, status: "submitted", ...(req.tenantId ? { tenantId: req.tenantId } : {}) });
    if (!transfer) return res.status(409).json({ message: "Only a submitted transfer can be approved." });

    // Enterprise Control: Segregation of Duties
    const preference = req.tenantId
      ? await InventoryPreference.findOne({ tenantId: req.tenantId, key: "default" }).lean()
      : null;

    if (preference?.enforceSegregationOfDuties) {
      if (transfer.createdBy && req.user?._id && String(transfer.createdBy) === String(req.user._id)) {
        return res.status(403).json({
          code: "CREATOR_CANNOT_APPROVE",
          message: "Segregation of duties violation: The creator of a stock transfer cannot approve it.",
        });
      }
    }

    const approvals = new Map(
      (Array.isArray(req.body.lines) ? req.body.lines : [])
        .filter((line) => isId(line.lineId))
        .map((line) => [String(line.lineId), parseQuantity(line.approvedQuantity)])
    );

    const productIds = [...new Set(transfer.lines.map((line) => String(line.product)))];
    const products = await Product.find({ _id: { $in: productIds }, ...(req.tenantId ? { tenantId: req.tenantId } : {}) }).select("trackingType").lean();
    const productMap = new Map(products.map((product) => [String(product._id), product]));

    for (let index = 0; index < transfer.lines.length; index += 1) {
      const line = transfer.lines[index];
      const approved = approvals.has(String(line._id))
        ? approvals.get(String(line._id))
        : line.requestedQuantity;
      if (!Number.isFinite(approved) || approved <= 0 || approved > line.requestedQuantity) {
        return res.status(400).json({ message: `Line ${index + 1}: approved quantity is invalid.` });
      }
      const product = productMap.get(String(line.product));
      if (product?.trackingType === "serial" && approved !== line.requestedQuantity) {
        return res.status(409).json({
          message: `Line ${index + 1}: partial approval is not supported for serial-tracked products. Split it into separate lines.`,
        });
      }
      line.approvedQuantity = approved;
    }

    transfer.status = "approved";
    transfer.approvedAt = new Date();
    transfer.approvedBy = req.user?._id || null;
    await transfer.save();

    if (req.user?._id) {
      await writeAudit({
        tenantId: req.tenantId || null,
        actorId: req.user._id,
        action: "approve",
        entityType: "StockTransfer",
        entityId: transfer._id,
        meta: { transferNo: transfer.transferNo },
      });
    }

    return res.json({ message: "Stock transfer approved.", transfer });
  } catch (error) {
    return sendWriteError(res, error, "Failed to approve stock transfer.");
  }
};

export const rejectStockTransfer = async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(400).json({ message: "Invalid stock transfer ID." });
    const reason = clean(req.body.reason);
    if (!reason) return res.status(400).json({ message: "Rejection reason is required." });
    const transfer = await StockTransfer.findOneAndUpdate(
      { _id: req.params.id, status: "submitted", ...(req.tenantId ? { tenantId: req.tenantId } : {}) },
      {
        status: "rejected",
        rejectedAt: new Date(),
        rejectedBy: req.user?._id || null,
        rejectionReason: reason,
        updatedBy: req.user?._id || null,
      },
      { new: true, runValidators: true }
    );
    if (!transfer) return res.status(409).json({ message: "Only a submitted transfer can be rejected." });
    return res.json({ message: "Stock transfer rejected.", transfer });
  } catch (error) {
    return sendWriteError(res, error, "Failed to reject stock transfer.");
  }
};

export const postDirectStockTransfer = async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(400).json({ message: "Invalid stock transfer ID." });
    const userId = req.user?._id || null;
    const transfer = await runMongoTransaction(async (session) => {
      const doc = await StockTransfer.findOne({
        _id: req.params.id,
        ...(req.tenantId ? { tenantId: req.tenantId } : {}),
      }).session(session);
      if (!doc) throw Object.assign(new Error("Stock transfer not found."), { statusCode: 404 });
      if (doc.status === "received" && doc.directMovement) return doc;
      if (doc.status !== "approved" || doc.transferMode !== "direct") {
        throw Object.assign(new Error("Only an approved direct transfer can be posted."), { statusCode: 409 });
      }

      const movement = await postDirectTransferStock({
        tenantId: req.tenantId,
        transfer: doc,
        userId,
        session,
      });

      for (let index = 0; index < doc.lines.length; index += 1) {
        const line = doc.lines[index];
        const movementLine = movement.lines[index];
        line.unitCost = movementLine.appliedUnitCost;
        line.dispatchedQuantity = line.approvedQuantity;
        line.receivedQuantity = line.approvedQuantity;
        line.receivedSerialNumbers = line.serialNumbers;
      }
      doc.directMovement = movement._id;
      doc.status = "received";
      doc.dispatchedAt = movement.postedAt;
      doc.dispatchedBy = userId;
      doc.receivedAt = movement.postedAt;
      doc.receivedBy = userId;
      doc.updatedBy = userId;
      await doc.save({ session });
      return doc;
    });

    return res.json({ message: "Direct stock transfer posted.", transfer });
  } catch (error) {
    return sendWriteError(res, error, "Failed to post direct stock transfer.");
  }
};

export const dispatchStockTransfer = async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(400).json({ message: "Invalid stock transfer ID." });
    const userId = req.user?._id || null;
    const transfer = await runMongoTransaction(async (session) => {
      const doc = await StockTransfer.findOne({
        _id: req.params.id,
        ...(req.tenantId ? { tenantId: req.tenantId } : {}),
      }).session(session);
      if (!doc) throw Object.assign(new Error("Stock transfer not found."), { statusCode: 404 });
      if (doc.status === "dispatched" && doc.dispatchMovement) return doc;
      if (doc.status !== "approved" || doc.transferMode !== "two_step") {
        throw Object.assign(new Error("Only an approved two-step transfer can be dispatched."), { statusCode: 409 });
      }

      const movement = await dispatchTransferStock({
        tenantId: req.tenantId,
        transfer: doc,
        userId,
        session,
      });

      for (let index = 0; index < doc.lines.length; index += 1) {
        const transferLine = doc.lines[index];
        const outLine = movement.lines[index * 2];
        transferLine.unitCost = outLine.appliedUnitCost;
        transferLine.dispatchedQuantity = transferLine.approvedQuantity;
      }
      doc.dispatchMovement = movement._id;
      doc.status = "dispatched";
      doc.dispatchedAt = movement.postedAt;
      doc.dispatchedBy = userId;
      doc.updatedBy = userId;
      await doc.save({ session });
      return doc;
    });

    return res.json({ message: "Stock transfer dispatched.", transfer });
  } catch (error) {
    return sendWriteError(res, error, "Failed to dispatch stock transfer.");
  }
};

export const receiveStockTransfer = async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(400).json({ message: "Invalid stock transfer ID." });
    const requestKey = clean(req.body.idempotencyKey);
    if (!requestKey || requestKey.length < 8) {
      return res.status(400).json({ message: "A unique idempotencyKey of at least 8 characters is required." });
    }
    const userId = req.user?._id || null;
    const fullKey = `stock-transfer:${req.params.id}:receipt:${requestKey}`;

    const existingMovement = await StockMovement.findOne({
      idempotencyKey: fullKey,
      ...(req.tenantId ? { tenantId: req.tenantId } : {}),
    }).select("_id").lean();
    if (existingMovement) {
      const existingTransfer = await StockTransfer.findOne({
        _id: req.params.id,
        ...(req.tenantId ? { tenantId: req.tenantId } : {}),
      }).lean();
      return res.json({ message: "This receipt was already posted.", transfer: existingTransfer });
    }

    const transfer = await runMongoTransaction(async (session) => {
      const doc = await StockTransfer.findOne({
        _id: req.params.id,
        ...(req.tenantId ? { tenantId: req.tenantId } : {}),
      }).session(session);
      if (!doc) throw Object.assign(new Error("Stock transfer not found."), { statusCode: 404 });
      if (!["dispatched", "partially_received"].includes(doc.status) || doc.transferMode !== "two_step") {
        throw Object.assign(new Error("Only a dispatched two-step transfer can be received."), { statusCode: 409 });
      }

      const requests = new Map(
        (Array.isArray(req.body.lines) ? req.body.lines : [])
          .filter((line) => isId(line.lineId))
          .map((line) => [
            String(line.lineId),
            {
              quantity: parseQuantity(line.quantity),
              serialNumbers: normalizeSerials(line.serialNumbers),
            },
          ])
      );
      const receiveAll = requests.size === 0;
      const movementLines = [];
      const receivedUpdates = [];
      let totalReceived = 0;
      const productIds = [...new Set(doc.lines.map((line) => String(line.product)))];
      const products = await Product.find({
        _id: { $in: productIds },
        ...(req.tenantId ? { tenantId: req.tenantId } : {}),
      })
        .select("trackingType")
        .session(session)
        .lean();
      const productMap = new Map(products.map((product) => [String(product._id), product]));

      for (let index = 0; index < doc.lines.length; index += 1) {
        const line = doc.lines[index];
        const remaining = roundQuantity(line.dispatchedQuantity - line.receivedQuantity - line.shortQuantity);
        if (remaining <= 0) continue;
        const request = requests.get(String(line._id));
        if (!receiveAll && !request) continue;
        const quantity = receiveAll ? remaining : request.quantity;
        if (!Number.isFinite(quantity) || quantity <= 0 || quantity > remaining) {
          throw Object.assign(new Error(`Line ${index + 1}: receive quantity is invalid.`), { statusCode: 400 });
        }

        const product = productMap.get(String(line.product));
        let serialNumbers = [];
        if (product?.trackingType === "serial") {
          serialNumbers = receiveAll
            ? line.serialNumbers.filter((serial) => !line.receivedSerialNumbers.includes(serial)).slice(0, quantity)
            : request.serialNumbers;
          if (!Number.isInteger(quantity) || serialNumbers.length !== quantity) {
            throw Object.assign(new Error(`Line ${index + 1}: provide one serial number per received unit.`), { statusCode: 400 });
          }
          const availableSerials = new Set(line.serialNumbers);
          const alreadyReceived = new Set(line.receivedSerialNumbers);
          if (serialNumbers.some((serial) => !availableSerials.has(serial) || alreadyReceived.has(serial))) {
            throw Object.assign(new Error(`Line ${index + 1}: serial number is invalid or already received.`), { statusCode: 409 });
          }
        }

        movementLines.push({
          product: line.product,
          effect: "incoming_clear",
          destinationWarehouse: doc.destinationWarehouse,
          destinationLocation: line.destinationLocation,
          quantity,
          requestedUnitCost: line.unitCost,
          lotNumber: line.lotNumber,
          note: `Clear incoming quantity for ${doc.transferNo}.`,
        });
        movementLines.push({
          product: line.product,
          effect: "in",
          destinationWarehouse: doc.destinationWarehouse,
          destinationLocation: line.destinationLocation,
          quantity,
          requestedUnitCost: line.unitCost,
          lotNumber: line.lotNumber,
          serialNumbers,
          manufactureDate: line.manufactureDate,
          expiryDate: line.expiryDate,
          note: line.note,
        });
        receivedUpdates.push({ line, quantity, serialNumbers });
        totalReceived = roundQuantity(totalReceived + quantity);
      }

      if (!movementLines.length) {
        throw Object.assign(new Error("No receivable transfer quantity was provided."), { statusCode: 400 });
      }

      const movement = await receiveTransferStock({
        tenantId: req.tenantId,
        transfer: doc,
        movementLines,
        idempotencyKey: fullKey,
        userId,
        session,
      });

      for (const update of receivedUpdates) {
        update.line.receivedQuantity = roundQuantity(update.line.receivedQuantity + update.quantity);
        update.line.receivedSerialNumbers = normalizeSerials([
          ...update.line.receivedSerialNumbers,
          ...update.serialNumbers,
        ]);
      }
      doc.receipts.push({
        movement: movement._id,
        idempotencyKey: fullKey,
        totalQuantity: totalReceived,
        receivedAt: movement.postedAt,
        receivedBy: userId,
      });

      const remainingTotal = roundQuantity(
        doc.lines.reduce(
          (sum, line) => sum + Math.max(line.dispatchedQuantity - line.receivedQuantity - line.shortQuantity, 0),
          0
        )
      );
      doc.status = remainingTotal > 0 ? "partially_received" : "received";
      if (remainingTotal <= 0) {
        doc.receivedAt = movement.postedAt;
        doc.receivedBy = userId;
      }
      doc.updatedBy = userId;
      await doc.save({ session });
      return doc;
    });

    return res.json({ message: "Stock transfer receipt posted.", transfer });
  } catch (error) {
    return sendWriteError(res, error, "Failed to receive stock transfer.");
  }
};

export const closeShortStockTransfer = async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(400).json({ message: "Invalid stock transfer ID." });
    const reason = clean(req.body.reason);
    if (!reason) return res.status(400).json({ message: "A close reason is required." });
    const userId = req.user?._id || null;

    const transfer = await runMongoTransaction(async (session) => {
      const doc = await StockTransfer.findOne({
        _id: req.params.id,
        ...(req.tenantId ? { tenantId: req.tenantId } : {}),
      }).session(session);
      if (!doc) throw Object.assign(new Error("Stock transfer not found."), { statusCode: 404 });
      if (!["dispatched", "partially_received"].includes(doc.status) || doc.transferMode !== "two_step") {
        throw Object.assign(new Error("Only an in-transit transfer can be closed with a shortage."), { statusCode: 409 });
      }

      const movement = await closeShortTransferStock({
        tenantId: req.tenantId,
        transfer: doc,
        reason,
        userId,
        session,
      });

      for (const line of doc.lines) {
        const remaining = roundQuantity(line.dispatchedQuantity - line.receivedQuantity - line.shortQuantity);
        if (remaining > 0) {
          line.shortQuantity = roundQuantity(line.shortQuantity + remaining);
        }
      }
      doc.closeMovement = movement._id;
      doc.status = "closed_short";
      doc.closedAt = movement.postedAt;
      doc.closedBy = userId;
      doc.closeReason = reason;
      doc.updatedBy = userId;
      await doc.save({ session });
      return doc;
    });

    return res.json({ message: "Stock transfer closed with shortage.", transfer });
  } catch (error) {
    return sendWriteError(res, error, "Failed to close stock transfer.");
  }
};

export const reverseStockTransfer = async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(400).json({ message: "Invalid stock transfer ID." });
    const reason = clean(req.body.reason);
    if (!reason) return res.status(400).json({ message: "Reversal reason is required." });
    const userId = req.user?._id || null;

    const transfer = await runMongoTransaction(async (session) => {
      const doc = await StockTransfer.findOne({
        _id: req.params.id,
        ...(req.tenantId ? { tenantId: req.tenantId } : {}),
      }).session(session);
      if (!doc) throw Object.assign(new Error("Stock transfer not found."), { statusCode: 404 });
      if (doc.status === "reversed") return doc;
      if (!["dispatched", "partially_received", "received", "closed_short"].includes(doc.status)) {
        throw Object.assign(new Error("This transfer has no posted stock effect to reverse."), { statusCode: 409 });
      }

      const reversals = [];
      for (const receipt of [...doc.receipts].reverse()) {
        const reversal = await StockMovement.reverseMovementDocument({
          movementId: receipt.movement,
          userId,
          reason: `${reason} — receipt reversal for ${doc.transferNo}`,
          session,
        });
        reversals.push(reversal._id);
      }
      if (doc.closeMovement) {
        const reversal = await StockMovement.reverseMovementDocument({
          movementId: doc.closeMovement,
          userId,
          reason: `${reason} — shortage-close reversal for ${doc.transferNo}`,
          session,
        });
        reversals.push(reversal._id);
      }
      if (doc.dispatchMovement) {
        const reversal = await StockMovement.reverseMovementDocument({
          movementId: doc.dispatchMovement,
          userId,
          reason: `${reason} — dispatch reversal for ${doc.transferNo}`,
          session,
        });
        reversals.push(reversal._id);
      }
      if (doc.directMovement) {
        const reversal = await StockMovement.reverseMovementDocument({
          movementId: doc.directMovement,
          userId,
          reason: `${reason} — direct transfer reversal for ${doc.transferNo}`,
          session,
        });
        reversals.push(reversal._id);
      }

      doc.status = "reversed";
      doc.reversalMovements = reversals;
      doc.reversedAt = new Date();
      doc.reversedBy = userId;
      doc.reversalReason = reason;
      doc.updatedBy = userId;
      await doc.save({ session });
      return doc;
    });

    return res.json({ message: "Stock transfer reversed with compensating movements.", transfer });
  } catch (error) {
    return sendWriteError(res, error, "Failed to reverse stock transfer.");
  }
};

export const cancelStockTransfer = async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(400).json({ message: "Invalid stock transfer ID." });
    const reason = clean(req.body.reason);
    if (!reason) return res.status(400).json({ message: "Cancellation reason is required." });
    const transfer = await StockTransfer.findOneAndUpdate(
      {
        _id: req.params.id,
        status: { $in: ["draft", "submitted", "approved"] },
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
    );
    if (!transfer) return res.status(409).json({ message: "Only an unposted transfer can be cancelled." });
    return res.json({ message: "Stock transfer cancelled.", transfer });
  } catch (error) {
    return sendWriteError(res, error, "Failed to cancel stock transfer.");
  }
};

export const deleteStockTransfer = async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(400).json({ message: "Invalid stock transfer ID." });
    const transfer = await StockTransfer.findOneAndDelete({
      _id: req.params.id,
      status: "draft",
      ...(req.tenantId ? { tenantId: req.tenantId } : {}),
    });
    if (!transfer) return res.status(409).json({ message: "Only a draft stock transfer can be deleted." });
    return res.json({ message: "Stock transfer deleted." });
  } catch (error) {
    return res.status(500).json({ message: "Failed to delete stock transfer.", error: error.message });
  }
};

export { TRANSFER_MODES, TRANSFER_STATUSES };
