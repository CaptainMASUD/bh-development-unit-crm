import mongoose from "mongoose";
import Supplier from "../models/supplier.model.js";
import Product from "../models/inventory/product.model.js";
import Warehouse from "../models/inventory/warehouse.model.js";
import WarehouseLocation from "../models/inventory/warehouseLocation.model.js";
import PurchaseOrder, {
  roundQuantity as roundOrderQuantity,
} from "../models/purchaseOrder.model.js";
import GoodsReceipt, {
  roundQuantity as roundReceiptQuantity,
} from "../models/goodsReceipt.model.js";
import PurchaseReturn, {
  PURCHASE_RETURN_EDITABLE_STATUSES,
  PURCHASE_RETURN_REASONS,
  PURCHASE_RETURN_STATUSES,
  RETURN_STOCK_BUCKETS,
  roundMoney,
  roundQuantity,
} from "../models/purchaseReturn.model.js";
import StockMovement from "../models/inventory/stockMovement.model.js";

const LIST_FIELDS = [
  "returnNo",
  "returnDate",
  "supplier",
  "supplierSnapshot",
  "purchaseOrder",
  "goodsReceipt",
  "warehouse",
  "supplierReturnAuthorization",
  "currency",
  "lineCount",
  "totalReturnQuantity",
  "totalReturnValue",
  "status",
  "submittedAt",
  "approvedAt",
  "postedAt",
  "movement",
  "reversalMovement",
  "createdBy",
  "updatedAt",
].join(" ");

const clean = (value) => String(value ?? "").trim();
const runTransaction = (session, work) =>
  session.withTransaction(work, {
    readConcern: { level: "snapshot" },
    writeConcern: { w: "majority" },
  });
const isId = (value) => mongoose.Types.ObjectId.isValid(String(value || ""));
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const parseLimit = (value, fallback = 30, max = 100) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.trunc(parsed), 1), max);
};

const parseNumber = (value) => {
  if (value === "" || value === null || value === undefined) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
};

const parseDate = (value, fallback = null) => {
  if (!value) return fallback;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const nullableId = (value) => {
  const normalized = clean(value);
  if (!normalized) return null;
  return isId(normalized) ? normalized : undefined;
};

const uniqueIds = (values = []) => [
  ...new Set(values.filter(Boolean).map((value) => String(value))),
];

const encodeCursor = (purchaseReturn) =>
  Buffer.from(
    JSON.stringify({
      d: new Date(purchaseReturn.returnDate).toISOString(),
      id: String(purchaseReturn._id),
    }),
    "utf8"
  ).toString("base64url");

const decodeCursor = (value) => {
  try {
    if (!value) return null;
    const parsed = JSON.parse(
      Buffer.from(String(value), "base64url").toString("utf8")
    );
    const date = parseDate(parsed?.d);
    if (!date || !isId(parsed?.id)) return null;
    return { date, id: new mongoose.Types.ObjectId(parsed.id) };
  } catch {
    return null;
  }
};

const nextDocumentNumber = async ({ prefix, date, session }) => {
  const year = new Date(date || Date.now()).getUTCFullYear();
  const key = `${prefix}:${year}`;
  const result = await mongoose.connection
    .collection("documentSequences")
    .findOneAndUpdate(
      { _id: key },
      {
        $inc: { sequence: 1 },
        $setOnInsert: { prefix, year, createdAt: new Date() },
        $set: { updatedAt: new Date() },
      },
      { upsert: true, returnDocument: "after", session }
    );
  const sequence = result?.sequence ?? result?.value?.sequence;
  if (!Number.isFinite(sequence)) {
    throw Object.assign(new Error("Failed to allocate a purchase-return number."), {
      statusCode: 500,
    });
  }
  return `${prefix}-${year}-${String(sequence).padStart(4, "0")}`;
};

const sanitizeSerials = (values = []) => [
  ...new Set(
    (Array.isArray(values) ? values : [])
      .map((value) => clean(value).toUpperCase())
      .filter(Boolean)
  ),
];

const buildLinePayload = (line = {}) => ({
  _id: isId(line._id) ? line._id : undefined,
  purchaseOrderLine: nullableId(line.purchaseOrderLine),
  goodsReceiptLine: nullableId(line.goodsReceiptLine),
  product: nullableId(line.product),
  purchaseUnit: nullableId(line.purchaseUnit),
  sourceLocation: nullableId(line.sourceLocation),
  stockBucket: clean(line.stockBucket || "available").toLowerCase(),
  returnQuantity: parseNumber(line.returnQuantity ?? line.quantity),
  unitCost: parseNumber(line.unitCost) ?? 0,
  reasonCode: clean(line.reasonCode || "other").toLowerCase(),
  reasonDetails: clean(line.reasonDetails),
  lotNumber: clean(line.lotNumber).toUpperCase(),
  serialNumbers: sanitizeSerials(line.serialNumbers),
});

const buildPayload = (body = {}) => {
  const payload = {};
  if (body.returnDate !== undefined) payload.returnDate = parseDate(body.returnDate);
  for (const field of ["supplier", "purchaseOrder", "goodsReceipt", "warehouse"]) {
    if (body[field] !== undefined) payload[field] = nullableId(body[field]);
  }
  for (const field of [
    "supplierReturnAuthorization",
    "notes",
    "idempotencyKey",
  ]) {
    if (body[field] !== undefined) payload[field] = clean(body[field]);
  }
  if (body.currency !== undefined) {
    payload.currency = clean(body.currency || "BDT").toUpperCase();
  }
  if (body.lines !== undefined) {
    payload.lines = Array.isArray(body.lines)
      ? body.lines.map(buildLinePayload)
      : undefined;
  }
  return payload;
};

const validatePayload = (payload, { partial = false } = {}) => {
  const errors = [];
  if ((!partial || payload.returnDate !== undefined) && !payload.returnDate) {
    errors.push("A valid purchase-return date is required.");
  }
  if ((!partial || payload.goodsReceipt !== undefined) && !payload.goodsReceipt) {
    errors.push("A valid posted goods receipt is required.");
  }
  if ((!partial || payload.warehouse !== undefined) && !payload.warehouse) {
    errors.push("A valid return warehouse is required.");
  }
  if (
    (!partial || payload.lines !== undefined) &&
    (!Array.isArray(payload.lines) || !payload.lines.length)
  ) {
    errors.push("At least one purchase-return line is required.");
  }
  if (Array.isArray(payload.lines) && payload.lines.length > 500) {
    errors.push("A purchase return cannot contain more than 500 lines.");
  }

  for (let index = 0; index < (payload.lines || []).length; index += 1) {
    const line = payload.lines[index];
    const label = `Line ${index + 1}`;
    if (!line.goodsReceiptLine) errors.push(`${label}: goods-receipt line is required.`);
    if (!line.purchaseOrderLine) errors.push(`${label}: purchase-order line is required.`);
    if (!line.product) errors.push(`${label}: product is required.`);
    if (line.stockBucket === "quarantine" && !line.sourceLocation) {
      errors.push(`${label}: source location is required for quarantine stock.`);
    }
    if (!RETURN_STOCK_BUCKETS.includes(line.stockBucket)) {
      errors.push(`${label}: stock bucket is invalid.`);
    }
    if (!Number.isFinite(line.returnQuantity) || line.returnQuantity <= 0) {
      errors.push(`${label}: return quantity must be greater than zero.`);
    }
    if (!Number.isFinite(line.unitCost) || line.unitCost < 0) {
      errors.push(`${label}: unit cost must be a valid non-negative number.`);
    }
    if (!PURCHASE_RETURN_REASONS.includes(line.reasonCode)) {
      errors.push(`${label}: return reason is invalid.`);
    }
  }
  return errors;
};

const loadAndEnrichReferences = async (payload, { session = null } = {}) => {
  const receiptQuery = GoodsReceipt.findById(payload.goodsReceipt).select(
    "receiptNo receiptDate purchaseOrder supplier supplierSnapshot warehouse currency status lines"
  );
  const warehouseQuery = Warehouse.findOne({
    _id: payload.warehouse,
    status: "active",
  }).select("name code status");
  if (session) {
    receiptQuery.session(session);
    warehouseQuery.session(session);
  }
  let receipt;
  let warehouse;
  if (session) {
    receipt = await receiptQuery;
    warehouse = await warehouseQuery.lean();
  } else {
    [receipt, warehouse] = await Promise.all([receiptQuery, warehouseQuery.lean()]);
  }

  if (!receipt) {
    throw Object.assign(new Error("Goods receipt not found."), { statusCode: 404 });
  }
  if (receipt.status !== "posted") {
    throw Object.assign(new Error("Purchase returns require a posted goods receipt."), {
      statusCode: 409,
    });
  }
  if (!warehouse || String(receipt.warehouse) !== String(payload.warehouse)) {
    throw Object.assign(
      new Error("The selected warehouse does not match the goods receipt or is inactive."),
      { statusCode: 409 }
    );
  }
  if (payload.purchaseOrder && String(payload.purchaseOrder) !== String(receipt.purchaseOrder)) {
    throw Object.assign(new Error("The selected purchase order does not match the goods receipt."), {
      statusCode: 409,
    });
  }
  if (payload.supplier && String(payload.supplier) !== String(receipt.supplier)) {
    throw Object.assign(new Error("The selected supplier does not match the goods receipt."), {
      statusCode: 409,
    });
  }

  const orderQuery = PurchaseOrder.findById(receipt.purchaseOrder).select(
    "orderNo supplier status lines"
  );
  const supplierQuery = Supplier.findById(receipt.supplier).select(
    "code businessName status"
  );
  if (session) {
    orderQuery.session(session);
    supplierQuery.session(session);
  }
  let order;
  let supplier;
  if (session) {
    order = await orderQuery;
    supplier = await supplierQuery.lean();
  } else {
    [order, supplier] = await Promise.all([orderQuery, supplierQuery.lean()]);
  }
  if (!order) {
    throw Object.assign(new Error("Related purchase order not found."), { statusCode: 409 });
  }
  if (!supplier) {
    throw Object.assign(new Error("Related supplier not found."), { statusCode: 409 });
  }

  const productIds = uniqueIds(payload.lines.map((line) => line.product));
  const locationIds = uniqueIds(payload.lines.map((line) => line.sourceLocation));
  const productQuery = Product.find({
    _id: { $in: productIds },
    status: { $ne: "archived" },
  }).select("name sku barcode status productType trackingType baseUnit");
  const locationQuery = WarehouseLocation.find({
    _id: { $in: locationIds },
    warehouse: payload.warehouse,
    status: "active",
  }).select("name code warehouse status isQuarantine");
  if (session) {
    productQuery.session(session);
    locationQuery.session(session);
  }
  let products;
  let locations;
  if (session) {
    products = await productQuery.lean();
    locations = await locationQuery.lean();
  } else {
    [products, locations] = await Promise.all([
      productQuery.lean(),
      locationQuery.lean(),
    ]);
  }
  if (products.length !== productIds.length) {
    throw Object.assign(new Error("One or more products are unavailable."), {
      statusCode: 409,
    });
  }
  if (locations.length !== locationIds.length) {
    throw Object.assign(new Error("One or more source locations are unavailable."), {
      statusCode: 409,
    });
  }

  const productMap = new Map(products.map((item) => [String(item._id), item]));
  const locationMap = new Map(locations.map((item) => [String(item._id), item]));
  const receiptLineMap = new Map(
    receipt.lines.map((line) => [String(line._id), line])
  );
  const orderLineMap = new Map(order.lines.map((line) => [String(line._id), line]));
  const seenKeys = new Set();

  const lines = payload.lines.map((line, index) => {
    const receiptLine = receiptLineMap.get(String(line.goodsReceiptLine));
    const orderLine = orderLineMap.get(String(line.purchaseOrderLine));
    if (!receiptLine) {
      throw Object.assign(new Error(`Line ${index + 1}: goods-receipt line was not found.`), {
        statusCode: 409,
      });
    }
    if (!orderLine) {
      throw Object.assign(new Error(`Line ${index + 1}: purchase-order line was not found.`), {
        statusCode: 409,
      });
    }
    if (
      String(receiptLine.purchaseOrderLine) !== String(line.purchaseOrderLine) ||
      String(receiptLine.product) !== String(line.product) ||
      String(orderLine.product) !== String(line.product)
    ) {
      throw Object.assign(
        new Error(`Line ${index + 1}: product, receipt line, and purchase-order line do not match.`),
        { statusCode: 409 }
      );
    }

    const uniquenessKey = `${receiptLine._id}:${line.stockBucket}`;
    if (seenKeys.has(uniquenessKey)) {
      throw Object.assign(
        new Error(`Line ${index + 1}: the same receipt line and stock bucket cannot appear twice.`),
        { statusCode: 400 }
      );
    }
    seenKeys.add(uniquenessKey);

    const product = productMap.get(String(line.product));
    const location = line.sourceLocation
      ? locationMap.get(String(line.sourceLocation))
      : null;
    const expectedLocation =
      line.stockBucket === "quarantine"
        ? receiptLine.quarantineLocation
        : receiptLine.acceptedLocation;
    if (String(expectedLocation || "") !== String(line.sourceLocation || "")) {
      throw Object.assign(
        new Error(`Line ${index + 1}: source location does not match the selected receipt stock bucket.`),
        { statusCode: 409 }
      );
    }
    if (line.stockBucket === "quarantine" && location?.isQuarantine !== true) {
      throw Object.assign(
        new Error(`Line ${index + 1}: quarantine returns require a quarantine location.`),
        { statusCode: 409 }
      );
    }

    const receivedInBucket =
      line.stockBucket === "quarantine"
        ? Number(receiptLine.quarantineQuantity || 0)
        : Number(receiptLine.acceptedQuantity || 0);
    const alreadyReturned =
      line.stockBucket === "quarantine"
        ? Number(receiptLine.returnedQuarantineQuantity || 0)
        : Number(receiptLine.returnedAvailableQuantity || 0);
    const returnable = roundQuantity(receivedInBucket - alreadyReturned);
    if (line.returnQuantity > returnable) {
      throw Object.assign(
        new Error(`Line ${index + 1}: return quantity exceeds the currently returnable quantity.`),
        { statusCode: 409 }
      );
    }

    if (
      product.trackingType === "serial" &&
      line.serialNumbers.length !== roundQuantity(line.returnQuantity)
    ) {
      throw Object.assign(
        new Error(`Line ${index + 1}: serial-tracked product requires one serial number per returned unit.`),
        { statusCode: 409 }
      );
    }

    return {
      ...line,
      purchaseUnit: line.purchaseUnit || receiptLine.purchaseUnit || orderLine.purchaseUnit || product.baseUnit || null,
      previouslyReturnedQuantity: roundQuantity(alreadyReturned),
      returnableQuantity: returnable,
      unitCost: roundMoney(line.unitCost || receiptLine.unitCost || orderLine.unitPrice || 0),
      lotNumber: line.lotNumber || receiptLine.lotNumber || "",
      productSnapshot: {
        code: product.sku || "",
        name: product.name || "",
      },
      unitSnapshot: receiptLine.unitSnapshot || orderLine.unitSnapshot || {},
    };
  });

  return {
    ...payload,
    supplier: receipt.supplier,
    supplierSnapshot: {
      code: supplier.code || receipt.supplierSnapshot?.code || "",
      name: supplier.businessName || receipt.supplierSnapshot?.name || "",
    },
    purchaseOrder: receipt.purchaseOrder,
    warehouse: receipt.warehouse,
    currency: payload.currency || receipt.currency || "BDT",
    lines,
    receipt,
    order,
  };
};

const updateReturnReferences = async ({
  receipt,
  order,
  returnLines,
  direction,
  userId,
  session,
}) => {
  const receiptLineMap = new Map(
    receipt.lines.map((line) => [String(line._id), line])
  );
  const orderLineMap = new Map(order.lines.map((line) => [String(line._id), line]));

  for (const returnLine of returnLines) {
    const receiptLine = receiptLineMap.get(String(returnLine.goodsReceiptLine));
    const orderLine = orderLineMap.get(String(returnLine.purchaseOrderLine));
    if (!receiptLine || !orderLine) {
      throw Object.assign(new Error("Related receipt or purchase-order line changed."), {
        statusCode: 409,
      });
    }
    const delta = direction * Number(returnLine.returnQuantity || 0);
    if (returnLine.stockBucket === "quarantine") {
      receiptLine.returnedQuarantineQuantity = roundReceiptQuantity(
        Number(receiptLine.returnedQuarantineQuantity || 0) + delta
      );
      if (receiptLine.returnedQuarantineQuantity < 0) {
        receiptLine.returnedQuarantineQuantity = 0;
      }
    } else {
      receiptLine.returnedAvailableQuantity = roundReceiptQuantity(
        Number(receiptLine.returnedAvailableQuantity || 0) + delta
      );
      if (receiptLine.returnedAvailableQuantity < 0) {
        receiptLine.returnedAvailableQuantity = 0;
      }
    }
    receiptLine.returnedQuantity = roundReceiptQuantity(
      Number(receiptLine.returnedAvailableQuantity || 0) +
        Number(receiptLine.returnedQuarantineQuantity || 0)
    );

    orderLine.returnedQuantity = roundOrderQuantity(
      Number(orderLine.returnedQuantity || 0) + delta
    );
    if (orderLine.returnedQuantity < 0) orderLine.returnedQuantity = 0;
  }

  receipt.updatedBy = userId;
  order.updatedBy = userId;
  await receipt.save({ session });
  await order.save({ session });
};

const movementLinesFromReturn = (purchaseReturn) =>
  purchaseReturn.lines.map((line) => ({
    product: line.product,
    effect: line.stockBucket === "quarantine" ? "out_quarantine" : "out",
    sourceWarehouse: purchaseReturn.warehouse,
    sourceLocation: line.sourceLocation,
    quantity: line.returnQuantity,
    requestedUnitCost: line.unitCost,
    lotNumber: line.lotNumber || "",
    serialNumbers: line.serialNumbers || [],
    note: `Purchase return ${purchaseReturn.returnNo}: ${line.reasonCode}`,
  }));

const duplicateMessage = (error) => {
  const fields = Object.keys(error?.keyPattern || error?.keyValue || {});
  if (fields.includes("returnNo")) return "A purchase return with this number already exists.";
  if (fields.includes("idempotencyKey")) return "This purchase-return request already exists.";
  if (fields.includes("movement")) return "This purchase return has already been posted.";
  return "A duplicate purchase return already exists.";
};

const sendError = (res, error, fallbackMessage) => {
  if (error?.code === 11000) return res.status(409).json({ message: duplicateMessage(error) });
  if (error?.name === "ValidationError" || error?.name === "CastError") {
    return res.status(400).json({ message: error.message });
  }
  if (error?.name === "VersionError") {
    return res.status(409).json({
      message: "The purchase return changed after it was opened. Reload it and try again.",
    });
  }
  return res.status(error?.statusCode || 500).json({
    message: error?.statusCode ? error.message : fallbackMessage,
    ...(process.env.NODE_ENV !== "production" ? { error: error.message } : {}),
  });
};

const populateReturn = (query) =>
  query
    .populate("supplier", "code businessName primaryEmail primaryPhone status")
    .populate("purchaseOrder", "orderNo orderDate status currency")
    .populate("goodsReceipt", "receiptNo receiptDate status currency")
    .populate("warehouse", "name code status")
    .populate("lines.product", "name sku barcode productType trackingType status")
    .populate("lines.purchaseUnit", "name code symbol status")
    .populate("lines.sourceLocation", "name code warehouse status isQuarantine")
    .populate("movement", "movementNo movementDate status totalQuantity totalValue")
    .populate("reversalMovement", "movementNo movementDate status totalQuantity totalValue")
    .populate("submittedBy", "name email")
    .populate("approvedBy", "name email")
    .populate("postedBy", "name email")
    .populate("createdBy", "name email");

const buildListFilter = (query = {}) => {
  const filter = {};
  if (query.status && query.status !== "all") {
    const status = clean(query.status).toLowerCase();
    if (!PURCHASE_RETURN_STATUSES.includes(status)) {
      throw Object.assign(new Error("Purchase-return status filter is invalid."), {
        statusCode: 400,
      });
    }
    filter.status = status;
  }
  if (isId(query.supplier)) filter.supplier = query.supplier;
  if (isId(query.purchaseOrder)) filter.purchaseOrder = query.purchaseOrder;
  if (isId(query.goodsReceipt)) filter.goodsReceipt = query.goodsReceipt;
  if (isId(query.warehouse)) filter.warehouse = query.warehouse;
  if (isId(query.product)) filter["lines.product"] = query.product;
  const from = parseDate(query.dateFrom);
  const to = parseDate(query.dateTo);
  if (from || to) {
    filter.returnDate = {};
    if (from) filter.returnDate.$gte = from;
    if (to) {
      to.setHours(23, 59, 59, 999);
      filter.returnDate.$lte = to;
    }
  }
  const q = clean(query.q);
  if (q) filter.returnNo = new RegExp(`^${escapeRegex(q.toUpperCase())}`);
  return filter;
};

export const getPurchaseReturnMeta = async (_req, res) =>
  res.json({
    statuses: PURCHASE_RETURN_STATUSES,
    editableStatuses: PURCHASE_RETURN_EDITABLE_STATUSES,
    reasons: PURCHASE_RETURN_REASONS,
    stockBuckets: RETURN_STOCK_BUCKETS,
  });

export const listPurchaseReturns = async (req, res) => {
  try {
    const limit = parseLimit(req.query.limit, 30, 100);
    const cursor = decodeCursor(req.query.cursor);
    if (req.query.cursor && !cursor) {
      return res.status(400).json({ message: "Invalid pagination cursor." });
    }
    const filter = buildListFilter(req.query);
    if (cursor) {
      filter.$and = [
        ...(filter.$and || []),
        {
          $or: [
            { returnDate: { $lt: cursor.date } },
            { returnDate: cursor.date, _id: { $lt: cursor.id } },
          ],
        },
      ];
    }
    const returns = await PurchaseReturn.find(filter)
      .select(LIST_FIELDS)
      .populate("supplier", "code businessName status")
      .populate("purchaseOrder", "orderNo status")
      .populate("goodsReceipt", "receiptNo status")
      .populate("warehouse", "name code status")
      .sort({ returnDate: -1, _id: -1 })
      .limit(limit + 1)
      .maxTimeMS(5000)
      .lean();
    const hasMore = returns.length > limit;
    if (hasMore) returns.pop();
    return res.json({
      count: returns.length,
      hasMore,
      nextCursor:
        hasMore && returns.length ? encodeCursor(returns[returns.length - 1]) : null,
      purchaseReturns: returns,
    });
  } catch (error) {
    return sendError(res, error, "Failed to load purchase returns.");
  }
};

export const getPurchaseReturnSummary = async (req, res) => {
  try {
    const filter = buildListFilter(req.query);
    const [summary] = await PurchaseReturn.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          returnCount: { $sum: 1 },
          draftCount: { $sum: { $cond: [{ $eq: ["$status", "draft"] }, 1, 0] } },
          submittedCount: { $sum: { $cond: [{ $eq: ["$status", "submitted"] }, 1, 0] } },
          approvedCount: { $sum: { $cond: [{ $eq: ["$status", "approved"] }, 1, 0] } },
          postedCount: { $sum: { $cond: [{ $eq: ["$status", "posted"] }, 1, 0] } },
          reversedCount: { $sum: { $cond: [{ $eq: ["$status", "reversed"] }, 1, 0] } },
          totalReturnQuantity: { $sum: "$totalReturnQuantity" },
          totalReturnValue: { $sum: "$totalReturnValue" },
        },
      },
      { $project: { _id: 0 } },
    ]).option({ maxTimeMS: 5000 });
    return res.json({
      summary: summary || {
        returnCount: 0,
        draftCount: 0,
        submittedCount: 0,
        approvedCount: 0,
        postedCount: 0,
        reversedCount: 0,
        totalReturnQuantity: 0,
        totalReturnValue: 0,
      },
    });
  } catch (error) {
    return sendError(res, error, "Failed to load purchase-return summary.");
  }
};

export const getPurchaseReturn = async (req, res) => {
  try {
    if (!isId(req.params.id)) {
      return res.status(400).json({ message: "Invalid purchase-return ID." });
    }
    const purchaseReturn = await populateReturn(PurchaseReturn.findById(req.params.id))
      .maxTimeMS(5000)
      .lean();
    if (!purchaseReturn) {
      return res.status(404).json({ message: "Purchase return not found." });
    }
    return res.json({ purchaseReturn });
  } catch (error) {
    return sendError(res, error, "Failed to load purchase return.");
  }
};

export const createPurchaseReturn = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    const actorId = req.user?._id || null;
    const payload = buildPayload(req.body);
    payload.returnDate = payload.returnDate || new Date();
    payload.idempotencyKey =
      clean(req.headers["idempotency-key"] || payload.idempotencyKey) || "";
    const errors = validatePayload(payload);
    if (errors.length) return res.status(400).json({ message: errors[0], errors });

    let purchaseReturn;
    await runTransaction(session, async () => {
      if (payload.idempotencyKey) {
        const existing = await PurchaseReturn.findOne({
          idempotencyKey: payload.idempotencyKey,
        }).session(session);
        if (existing) {
          purchaseReturn = existing;
          return;
        }
      }
      const enriched = await loadAndEnrichReferences(payload, { session });
      const returnNo = await nextDocumentNumber({
        prefix: "PRT",
        date: enriched.returnDate,
        session,
      });
      purchaseReturn = new PurchaseReturn({
        ...enriched,
        receipt: undefined,
        order: undefined,
        returnNo,
        status: "draft",
        createdBy: actorId,
        updatedBy: actorId,
      });
      await purchaseReturn.save({ session });
    });

    const populated = await populateReturn(
      PurchaseReturn.findById(purchaseReturn._id)
    ).lean();
    return res.status(201).json({
      message: "Purchase-return draft created.",
      purchaseReturn: populated,
    });
  } catch (error) {
    return sendError(res, error, "Failed to create purchase return.");
  } finally {
    await session.endSession();
  }
};

export const updatePurchaseReturn = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    if (!isId(req.params.id)) {
      return res.status(400).json({ message: "Invalid purchase-return ID." });
    }
    const payload = buildPayload(req.body);
    const editableKeys = Object.keys(payload).filter((key) => key !== "idempotencyKey");
    if (!editableKeys.length) {
      return res.status(400).json({ message: "No valid purchase-return fields were provided." });
    }
    const errors = validatePayload(payload, { partial: true });
    if (errors.length) return res.status(400).json({ message: errors[0], errors });

    let purchaseReturn;
    await runTransaction(session, async () => {
      const current = await PurchaseReturn.findById(req.params.id).session(session);
      if (!current) {
        throw Object.assign(new Error("Purchase return not found."), { statusCode: 404 });
      }
      if (!PURCHASE_RETURN_EDITABLE_STATUSES.includes(current.status)) {
        throw Object.assign(new Error("Only a draft purchase return can be edited."), {
          statusCode: 409,
        });
      }
      if (req.body.version !== undefined && Number(req.body.version) !== current.__v) {
        throw Object.assign(
          new Error("The purchase return changed after it was opened. Reload it and try again."),
          { statusCode: 409 }
        );
      }
      const candidate = {
        ...current.toObject(),
        ...payload,
        supplier: payload.supplier ?? current.supplier,
        purchaseOrder: payload.purchaseOrder ?? current.purchaseOrder,
        goodsReceipt: payload.goodsReceipt ?? current.goodsReceipt,
        warehouse: payload.warehouse ?? current.warehouse,
        lines: payload.lines ?? current.lines.map((line) => line.toObject()),
      };
      const enriched = await loadAndEnrichReferences(candidate, { session });
      for (const key of Object.keys(payload)) {
        if (key === "lines") current.lines = enriched.lines;
        else current[key] = enriched[key] ?? payload[key];
      }
      current.supplier = enriched.supplier;
      current.supplierSnapshot = enriched.supplierSnapshot;
      current.purchaseOrder = enriched.purchaseOrder;
      current.goodsReceipt = enriched.goodsReceipt;
      current.warehouse = enriched.warehouse;
      current.currency = enriched.currency;
      current.updatedBy = req.user?._id || null;
      await current.save({ session });
      purchaseReturn = current;
    });

    const populated = await populateReturn(
      PurchaseReturn.findById(purchaseReturn._id)
    ).lean();
    return res.json({
      message: "Purchase-return draft updated.",
      purchaseReturn: populated,
    });
  } catch (error) {
    return sendError(res, error, "Failed to update purchase return.");
  } finally {
    await session.endSession();
  }
};

export const submitPurchaseReturn = async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(400).json({ message: "Invalid purchase-return ID." });
    const purchaseReturn = await PurchaseReturn.findOne({
      _id: req.params.id,
      status: "draft",
    });
    if (!purchaseReturn) {
      return res.status(409).json({ message: "Only a draft purchase return can be submitted." });
    }
    purchaseReturn.status = "submitted";
    purchaseReturn.submittedAt = new Date();
    purchaseReturn.submittedBy = req.user?._id || null;
    purchaseReturn.updatedBy = req.user?._id || null;
    await purchaseReturn.save();
    return res.json({
      message: "Purchase return submitted for approval.",
      purchaseReturn,
    });
  } catch (error) {
    return sendError(res, error, "Failed to submit purchase return.");
  }
};

export const approvePurchaseReturn = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    if (!isId(req.params.id)) return res.status(400).json({ message: "Invalid purchase-return ID." });
    let purchaseReturn;
    await runTransaction(session, async () => {
      purchaseReturn = await PurchaseReturn.findOne({
        _id: req.params.id,
        status: "submitted",
      }).session(session);
      if (!purchaseReturn) {
        throw Object.assign(new Error("Only a submitted purchase return can be approved."), {
          statusCode: 409,
        });
      }
      await loadAndEnrichReferences(purchaseReturn.toObject(), { session });
      purchaseReturn.status = "approved";
      purchaseReturn.approvedAt = new Date();
      purchaseReturn.approvedBy = req.user?._id || null;
      purchaseReturn.updatedBy = req.user?._id || null;
      await purchaseReturn.save({ session });
    });
    return res.json({ message: "Purchase return approved.", purchaseReturn });
  } catch (error) {
    return sendError(res, error, "Failed to approve purchase return.");
  } finally {
    await session.endSession();
  }
};

export const postPurchaseReturn = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    if (!isId(req.params.id)) return res.status(400).json({ message: "Invalid purchase-return ID." });
    const actorId = req.user?._id || null;
    let purchaseReturn;
    let movement;

    await runTransaction(session, async () => {
      purchaseReturn = await PurchaseReturn.findById(req.params.id).session(session);
      if (!purchaseReturn) {
        throw Object.assign(new Error("Purchase return not found."), { statusCode: 404 });
      }
      if (purchaseReturn.status === "posted" && purchaseReturn.movement) {
        movement = await StockMovement.findById(purchaseReturn.movement).session(session);
        return;
      }
      if (purchaseReturn.status !== "approved") {
        throw Object.assign(new Error("Only an approved purchase return can be posted."), {
          statusCode: 409,
        });
      }

      const enriched = await loadAndEnrichReferences(purchaseReturn.toObject(), {
        session,
      });
      purchaseReturn.lines = enriched.lines;
      const stockLines = movementLinesFromReturn(purchaseReturn);
      const movementKey = `PRT:${purchaseReturn._id}:POST`;
      movement = await StockMovement.findOne({ idempotencyKey: movementKey }).session(session);
      if (!movement) {
        await StockMovement.validateDraftLines(stockLines, { session });
        movement = new StockMovement({
          movementDate: purchaseReturn.returnDate,
          movementType: "purchase_return",
          status: "draft",
          reference: purchaseReturn.returnNo,
          sourceType: "purchase_return",
          sourceId: purchaseReturn._id,
          idempotencyKey: movementKey,
          currency: purchaseReturn.currency,
          reason: `Purchase return against ${enriched.receipt.receiptNo}`,
          notes: `System-generated stock movement for ${purchaseReturn.returnNo}.`,
          lines: stockLines,
          createdBy: actorId,
          updatedBy: actorId,
        });
        await movement.save({ session });
      }
      if (movement.status === "draft") {
        movement = await StockMovement.postMovementDocument({
          movementId: movement._id,
          userId: actorId,
          session,
        });
      }

      await updateReturnReferences({
        receipt: enriched.receipt,
        order: enriched.order,
        returnLines: purchaseReturn.lines,
        direction: 1,
        userId: actorId,
        session,
      });

      purchaseReturn.status = "posted";
      purchaseReturn.movement = movement._id;
      purchaseReturn.postedAt = new Date();
      purchaseReturn.postedBy = actorId;
      purchaseReturn.updatedBy = actorId;
      await purchaseReturn.save({ session });
    });

    const populated = await populateReturn(
      PurchaseReturn.findById(purchaseReturn._id)
    ).lean();
    return res.json({
      message: "Purchase return posted and inventory reduced.",
      purchaseReturn: populated,
      movement,
    });
  } catch (error) {
    return sendError(res, error, "Failed to post purchase return.");
  } finally {
    await session.endSession();
  }
};

export const reversePurchaseReturn = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    if (!isId(req.params.id)) return res.status(400).json({ message: "Invalid purchase-return ID." });
    const reason = clean(req.body.reason);
    if (!reason) return res.status(400).json({ message: "Reversal reason is required." });
    const actorId = req.user?._id || null;
    let purchaseReturn;
    let reversal;

    await runTransaction(session, async () => {
      purchaseReturn = await PurchaseReturn.findById(req.params.id).session(session);
      if (!purchaseReturn) {
        throw Object.assign(new Error("Purchase return not found."), { statusCode: 404 });
      }
      if (purchaseReturn.status === "reversed" && purchaseReturn.reversalMovement) {
        reversal = await StockMovement.findById(purchaseReturn.reversalMovement).session(session);
        return;
      }
      if (purchaseReturn.status !== "posted" || !purchaseReturn.movement) {
        throw Object.assign(new Error("Only a posted purchase return can be reversed."), {
          statusCode: 409,
        });
      }

      const receipt = await GoodsReceipt.findById(
        purchaseReturn.goodsReceipt
      ).session(session);
      const order = await PurchaseOrder.findById(
        purchaseReturn.purchaseOrder
      ).session(session);
      if (!receipt || !order) {
        throw Object.assign(new Error("Related receipt or purchase order was not found."), {
          statusCode: 409,
        });
      }
      reversal = await StockMovement.reverseMovementDocument({
        movementId: purchaseReturn.movement,
        userId: actorId,
        reason,
        session,
      });
      await updateReturnReferences({
        receipt,
        order,
        returnLines: purchaseReturn.lines,
        direction: -1,
        userId: actorId,
        session,
      });
      purchaseReturn.status = "reversed";
      purchaseReturn.reversalMovement = reversal._id;
      purchaseReturn.reversedAt = new Date();
      purchaseReturn.reversedBy = actorId;
      purchaseReturn.reversalReason = reason;
      purchaseReturn.updatedBy = actorId;
      await purchaseReturn.save({ session });
    });

    const populated = await populateReturn(
      PurchaseReturn.findById(purchaseReturn._id)
    ).lean();
    return res.json({
      message: "Purchase return reversed with a compensating stock movement.",
      purchaseReturn: populated,
      reversalMovement: reversal,
    });
  } catch (error) {
    return sendError(res, error, "Failed to reverse purchase return.");
  } finally {
    await session.endSession();
  }
};

export const cancelPurchaseReturn = async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(400).json({ message: "Invalid purchase-return ID." });
    const reason = clean(req.body.reason);
    if (!reason) return res.status(400).json({ message: "Cancellation reason is required." });
    const purchaseReturn = await PurchaseReturn.findOne({
      _id: req.params.id,
      status: { $in: ["draft", "submitted", "approved"] },
      movement: null,
    });
    if (!purchaseReturn) {
      return res.status(409).json({ message: "This purchase return cannot be cancelled in its current status." });
    }
    purchaseReturn.status = "cancelled";
    purchaseReturn.cancelledAt = new Date();
    purchaseReturn.cancelledBy = req.user?._id || null;
    purchaseReturn.cancellationReason = reason;
    purchaseReturn.updatedBy = req.user?._id || null;
    await purchaseReturn.save();
    return res.json({ message: "Purchase return cancelled.", purchaseReturn });
  } catch (error) {
    return sendError(res, error, "Failed to cancel purchase return.");
  }
};

export const deletePurchaseReturn = async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(400).json({ message: "Invalid purchase-return ID." });
    const purchaseReturn = await PurchaseReturn.findOneAndDelete({
      _id: req.params.id,
      status: { $in: ["draft", "cancelled"] },
      movement: null,
    });
    if (!purchaseReturn) {
      return res.status(409).json({
        message: "Only an unposted draft or cancelled purchase return can be deleted.",
      });
    }
    return res.json({ message: "Purchase return deleted." });
  } catch (error) {
    return sendError(res, error, "Failed to delete purchase return.");
  }
};
