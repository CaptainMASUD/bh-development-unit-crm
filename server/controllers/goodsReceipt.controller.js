import mongoose from "mongoose";
import Supplier from "../models/supplier.model.js";
import Product from "../models/inventory/product.model.js";
import Warehouse from "../models/inventory/warehouse.model.js";
import WarehouseLocation from "../models/inventory/warehouseLocation.model.js";
import PurchaseOrder, {
  PURCHASE_ORDER_OPEN_STATUSES,
  roundQuantity as roundOrderQuantity,
} from "../models/purchaseOrder.model.js";
import GoodsReceipt, {
  GOODS_RECEIPT_EDITABLE_STATUSES,
  GOODS_RECEIPT_STATUSES,
  QUALITY_STATUSES,
  roundMoney,
  roundQuantity,
} from "../models/goodsReceipt.model.js";
import StockMovement from "../models/inventory/stockMovement.model.js";
import PurchaseReturn from "../models/purchaseReturn.model.js";

const LIST_FIELDS = [
  "receiptNo",
  "receiptDate",
  "purchaseOrder",
  "supplier",
  "supplierSnapshot",
  "warehouse",
  "supplierDeliveryNote",
  "supplierInvoiceNo",
  "currency",
  "lineCount",
  "totalReceivedQuantity",
  "totalAcceptedQuantity",
  "totalQuarantineQuantity",
  "totalRejectedQuantity",
  "totalReturnedQuantity",
  "totalAcceptedValue",
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

const encodeCursor = (receipt) =>
  Buffer.from(
    JSON.stringify({
      d: new Date(receipt.receiptDate).toISOString(),
      id: String(receipt._id),
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
    throw Object.assign(new Error("Failed to allocate a goods-receipt number."), {
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
  product: nullableId(line.product),
  purchaseUnit: nullableId(line.purchaseUnit),
  receivedQuantity: parseNumber(line.receivedQuantity ?? line.quantity),
  acceptedQuantity: parseNumber(line.acceptedQuantity) ?? 0,
  quarantineQuantity: parseNumber(line.quarantineQuantity) ?? 0,
  rejectedQuantity: parseNumber(line.rejectedQuantity) ?? 0,
  unitCost: parseNumber(line.unitCost) ?? 0,
  acceptedLocation: nullableId(line.acceptedLocation),
  quarantineLocation: nullableId(line.quarantineLocation),
  lotNumber: clean(line.lotNumber).toUpperCase(),
  serialNumbers: sanitizeSerials(line.serialNumbers),
  manufactureDate: line.manufactureDate ? parseDate(line.manufactureDate) : null,
  expiryDate: line.expiryDate ? parseDate(line.expiryDate) : null,
  inspectionNotes: clean(line.inspectionNotes),
});

const buildPayload = (body = {}) => {
  const payload = {};
  if (body.receiptDate !== undefined) payload.receiptDate = parseDate(body.receiptDate);
  for (const field of ["purchaseOrder", "supplier", "warehouse"]) {
    if (body[field] !== undefined) payload[field] = nullableId(body[field]);
  }
  for (const field of [
    "supplierDeliveryNote",
    "supplierInvoiceNo",
    "vehicleNo",
    "receivedByName",
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
  if ((!partial || payload.receiptDate !== undefined) && !payload.receiptDate) {
    errors.push("A valid goods-receipt date is required.");
  }
  if ((!partial || payload.purchaseOrder !== undefined) && !payload.purchaseOrder) {
    errors.push("A valid purchase order is required.");
  }
  if ((!partial || payload.warehouse !== undefined) && !payload.warehouse) {
    errors.push("A valid receiving warehouse is required.");
  }
  if (
    (!partial || payload.lines !== undefined) &&
    (!Array.isArray(payload.lines) || !payload.lines.length)
  ) {
    errors.push("At least one goods-receipt line is required.");
  }
  if (Array.isArray(payload.lines) && payload.lines.length > 500) {
    errors.push("A goods receipt cannot contain more than 500 lines.");
  }

  for (let index = 0; index < (payload.lines || []).length; index += 1) {
    const line = payload.lines[index];
    const label = `Line ${index + 1}`;
    if (!line.purchaseOrderLine) errors.push(`${label}: purchase-order line is required.`);
    if (!line.product) errors.push(`${label}: product is required.`);
    if (!Number.isFinite(line.receivedQuantity) || line.receivedQuantity <= 0) {
      errors.push(`${label}: received quantity must be greater than zero.`);
    }
    for (const field of ["acceptedQuantity", "quarantineQuantity", "rejectedQuantity", "unitCost"]) {
      if (!Number.isFinite(line[field]) || line[field] < 0) {
        errors.push(`${label}: ${field} must be a valid non-negative number.`);
      }
    }
    const allocated = roundQuantity(
      Number(line.acceptedQuantity || 0) +
        Number(line.quarantineQuantity || 0) +
        Number(line.rejectedQuantity || 0)
    );
    if (allocated !== roundQuantity(line.receivedQuantity)) {
      errors.push(`${label}: accepted, quarantine, and rejected quantities must equal received quantity.`);
    }
    if (line.quarantineQuantity > 0 && !line.quarantineLocation) {
      errors.push(`${label}: quarantine location is required for quarantined stock.`);
    }
    if (
      line.serialNumbers.length &&
      line.acceptedQuantity > 0 &&
      line.quarantineQuantity > 0
    ) {
      errors.push(
        `${label}: split accepted and quarantined serial-tracked stock into separate lines.`
      );
    }
    if (
      line.expiryDate &&
      line.manufactureDate &&
      line.expiryDate < line.manufactureDate
    ) {
      errors.push(`${label}: expiry date cannot be before manufacture date.`);
    }
  }
  return errors;
};

const loadAndEnrichReferences = async (payload, { session = null } = {}) => {
  const orderQuery = PurchaseOrder.findById(payload.purchaseOrder).select(
    "orderNo orderDate supplier supplierSnapshot defaultWarehouse currency status lines totalOrderedQuantity totalReceivedQuantity"
  );
  const warehouseQuery = Warehouse.findOne({
    _id: payload.warehouse,
    status: "active",
  }).select("name code status");
  if (session) {
    orderQuery.session(session);
    warehouseQuery.session(session);
  }
  let order;
  let warehouse;
  if (session) {
    order = await orderQuery;
    warehouse = await warehouseQuery.lean();
  } else {
    [order, warehouse] = await Promise.all([orderQuery, warehouseQuery.lean()]);
  }

  if (!order) {
    throw Object.assign(new Error("Purchase order not found."), { statusCode: 404 });
  }
  if (!PURCHASE_ORDER_OPEN_STATUSES.includes(order.status)) {
    throw Object.assign(
      new Error("Goods can only be received against an approved or partially received purchase order."),
      { statusCode: 409 }
    );
  }
  if (!warehouse) {
    throw Object.assign(new Error("The receiving warehouse is unavailable or inactive."), {
      statusCode: 409,
    });
  }
  if (payload.supplier && String(payload.supplier) !== String(order.supplier)) {
    throw Object.assign(new Error("The selected supplier does not match the purchase order."), {
      statusCode: 409,
    });
  }

  const supplierQuery = Supplier.findOne({
    _id: order.supplier,
    status: { $in: ["active", "on_hold"] },
  }).select("code businessName status");
  if (session) supplierQuery.session(session);
  const supplier = await supplierQuery.lean();
  if (!supplier) {
    throw Object.assign(new Error("The purchase-order supplier is unavailable."), {
      statusCode: 409,
    });
  }

  const locationIds = uniqueIds(
    payload.lines.flatMap((line) => [line.acceptedLocation, line.quarantineLocation])
  );
  const productIds = uniqueIds(payload.lines.map((line) => line.product));
  const locationQuery = WarehouseLocation.find({
    _id: { $in: locationIds },
    status: "active",
  }).select("name code warehouse status isQuarantine");
  const productQuery = Product.find({
    _id: { $in: productIds },
    status: { $ne: "archived" },
  }).select("name sku barcode status productType trackingType baseUnit purchasePrice");
  if (session) {
    locationQuery.session(session);
    productQuery.session(session);
  }
  let locations;
  let products;
  if (session) {
    locations = await locationQuery.lean();
    products = await productQuery.lean();
  } else {
    [locations, products] = await Promise.all([
      locationQuery.lean(),
      productQuery.lean(),
    ]);
  }
  if (locations.length !== locationIds.length) {
    throw Object.assign(new Error("One or more warehouse locations are unavailable."), {
      statusCode: 409,
    });
  }
  if (products.length !== productIds.length) {
    throw Object.assign(new Error("One or more products are unavailable."), {
      statusCode: 409,
    });
  }

  const locationMap = new Map(locations.map((item) => [String(item._id), item]));
  const productMap = new Map(products.map((item) => [String(item._id), item]));
  const orderLineMap = new Map(
    order.lines.map((line) => [String(line._id), line])
  );

  const seenOrderLines = new Set();
  const lines = payload.lines.map((line, index) => {
    const orderLine = orderLineMap.get(String(line.purchaseOrderLine));
    if (!orderLine) {
      throw Object.assign(
        new Error(`Line ${index + 1}: purchase-order line was not found.`),
        { statusCode: 409 }
      );
    }
    if (seenOrderLines.has(String(orderLine._id))) {
      throw Object.assign(
        new Error(`Line ${index + 1}: the same purchase-order line cannot appear twice.`),
        { statusCode: 400 }
      );
    }
    seenOrderLines.add(String(orderLine._id));

    if (String(orderLine.product) !== String(line.product)) {
      throw Object.assign(
        new Error(`Line ${index + 1}: product does not match the purchase-order line.`),
        { statusCode: 409 }
      );
    }

    const product = productMap.get(String(line.product));
    const remaining = roundQuantity(
      Number(orderLine.orderedQuantity || 0) -
        Number(orderLine.cancelledQuantity || 0) -
        Number(orderLine.receivedQuantity || 0)
    );
    const stockedQuantity = roundQuantity(
      Number(line.acceptedQuantity || 0) +
        Number(line.quarantineQuantity || 0)
    );
    if (stockedQuantity > remaining) {
      throw Object.assign(
        new Error(
          `Line ${index + 1}: accepted plus quarantine quantity exceeds the remaining purchase-order quantity.`
        ),
        { statusCode: 409 }
      );
    }

    for (const [field, requireQuarantine] of [
      ["acceptedLocation", false],
      ["quarantineLocation", true],
    ]) {
      if (!line[field]) continue;
      const location = locationMap.get(String(line[field]));
      if (!location || String(location.warehouse) !== String(payload.warehouse)) {
        throw Object.assign(
          new Error(`Line ${index + 1}: ${field} does not belong to the receiving warehouse.`),
          { statusCode: 409 }
        );
      }
      if (requireQuarantine && location.isQuarantine !== true) {
        throw Object.assign(
          new Error(`Line ${index + 1}: quarantine stock requires a quarantine location.`),
          { statusCode: 409 }
        );
      }
    }

    if (
      product.trackingType === "serial" &&
      line.serialNumbers.length !== roundQuantity(stockedQuantity)
    ) {
      throw Object.assign(
        new Error(
          `Line ${index + 1}: serial-tracked product requires one serial number per accepted or quarantined unit.`
        ),
        { statusCode: 409 }
      );
    }

    return {
      ...line,
      purchaseUnit: line.purchaseUnit || orderLine.purchaseUnit || product.baseUnit || null,
      orderedQuantity: roundQuantity(orderLine.orderedQuantity),
      previouslyReceivedQuantity: roundQuantity(orderLine.receivedQuantity),
      unitCost: roundMoney(line.unitCost || orderLine.unitPrice || product.purchasePrice || 0),
      productSnapshot: {
        code: product.sku || "",
        name: product.name || "",
      },
      unitSnapshot: orderLine.unitSnapshot || {},
    };
  });

  return {
    ...payload,
    supplier: order.supplier,
    supplierSnapshot: {
      code: supplier.code || order.supplierSnapshot?.code || "",
      name: supplier.businessName || order.supplierSnapshot?.name || "",
    },
    currency: payload.currency || order.currency || "BDT",
    lines,
    order,
  };
};

const updatePurchaseOrderReceiptState = async ({ order, receiptLines, direction, userId, session }) => {
  const lineMap = new Map(order.lines.map((line) => [String(line._id), line]));
  for (const receiptLine of receiptLines) {
    const orderLine = lineMap.get(String(receiptLine.purchaseOrderLine));
    if (!orderLine) {
      throw Object.assign(new Error("Purchase-order line changed and can no longer be updated."), {
        statusCode: 409,
      });
    }
    const stocked = roundQuantity(
      Number(receiptLine.acceptedQuantity || 0) +
        Number(receiptLine.quarantineQuantity || 0)
    );
    orderLine.receivedQuantity = roundOrderQuantity(
      Number(orderLine.receivedQuantity || 0) + direction * stocked
    );
    if (orderLine.receivedQuantity < 0) orderLine.receivedQuantity = 0;
  }

  const activeOrdered = roundOrderQuantity(
    order.lines.reduce(
      (sum, line) =>
        sum +
        Math.max(
          Number(line.orderedQuantity || 0) - Number(line.cancelledQuantity || 0),
          0
        ),
      0
    )
  );
  const totalReceived = roundOrderQuantity(
    order.lines.reduce((sum, line) => sum + Number(line.receivedQuantity || 0), 0)
  );
  if (totalReceived <= 0) order.status = "approved";
  else if (totalReceived >= activeOrdered) order.status = "received";
  else order.status = "partially_received";
  order.updatedBy = userId;
  await order.save({ session });
};

const movementLinesFromReceipt = (receipt) => {
  const lines = [];
  for (const line of receipt.lines) {
    const common = {
      product: line.product,
      quantity: 0,
      requestedUnitCost: line.unitCost,
      lotNumber: line.lotNumber || "",
      serialNumbers: line.serialNumbers || [],
      manufactureDate: line.manufactureDate || null,
      expiryDate: line.expiryDate || null,
      note: `Goods receipt ${receipt.receiptNo}`,
    };
    if (line.acceptedQuantity > 0) {
      lines.push({
        ...common,
        effect: "in",
        destinationWarehouse: receipt.warehouse,
        destinationLocation: line.acceptedLocation,
        quantity: line.acceptedQuantity,
      });
    }
    if (line.quarantineQuantity > 0) {
      lines.push({
        ...common,
        effect: "in_quarantine",
        destinationWarehouse: receipt.warehouse,
        destinationLocation: line.quarantineLocation,
        quantity: line.quarantineQuantity,
      });
    }
  }
  return lines;
};

const duplicateMessage = (error) => {
  const fields = Object.keys(error?.keyPattern || error?.keyValue || {});
  if (fields.includes("receiptNo")) return "A goods receipt with this number already exists.";
  if (fields.includes("idempotencyKey")) return "This goods-receipt request already exists.";
  if (fields.includes("movement")) return "This goods receipt has already been posted.";
  return "A duplicate goods receipt already exists.";
};

const sendError = (res, error, fallbackMessage) => {
  if (error?.code === 11000) return res.status(409).json({ message: duplicateMessage(error) });
  if (error?.name === "ValidationError" || error?.name === "CastError") {
    return res.status(400).json({ message: error.message });
  }
  if (error?.name === "VersionError") {
    return res.status(409).json({
      message: "The goods receipt changed after it was opened. Reload it and try again.",
    });
  }
  return res.status(error?.statusCode || 500).json({
    message: error?.statusCode ? error.message : fallbackMessage,
    ...(process.env.NODE_ENV !== "production" ? { error: error.message } : {}),
  });
};

const populateReceipt = (query) =>
  query
    .populate("purchaseOrder", "orderNo orderDate status currency grandTotal")
    .populate("supplier", "code businessName primaryEmail primaryPhone status")
    .populate("warehouse", "name code status")
    .populate("lines.product", "name sku barcode productType trackingType status")
    .populate("lines.purchaseUnit", "name code symbol status")
    .populate("lines.acceptedLocation", "name code warehouse status isQuarantine")
    .populate("lines.quarantineLocation", "name code warehouse status isQuarantine")
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
    if (!GOODS_RECEIPT_STATUSES.includes(status)) {
      throw Object.assign(new Error("Goods-receipt status filter is invalid."), {
        statusCode: 400,
      });
    }
    filter.status = status;
  }
  if (isId(query.purchaseOrder)) filter.purchaseOrder = query.purchaseOrder;
  if (isId(query.supplier)) filter.supplier = query.supplier;
  if (isId(query.warehouse)) filter.warehouse = query.warehouse;
  if (isId(query.product)) filter["lines.product"] = query.product;
  const from = parseDate(query.dateFrom);
  const to = parseDate(query.dateTo);
  if (from || to) {
    filter.receiptDate = {};
    if (from) filter.receiptDate.$gte = from;
    if (to) {
      to.setHours(23, 59, 59, 999);
      filter.receiptDate.$lte = to;
    }
  }
  const q = clean(query.q);
  if (q) filter.receiptNo = new RegExp(`^${escapeRegex(q.toUpperCase())}`);
  return filter;
};

export const getGoodsReceiptMeta = async (_req, res) =>
  res.json({
    statuses: GOODS_RECEIPT_STATUSES,
    editableStatuses: GOODS_RECEIPT_EDITABLE_STATUSES,
    qualityStatuses: QUALITY_STATUSES,
  });

export const listGoodsReceipts = async (req, res) => {
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
            { receiptDate: { $lt: cursor.date } },
            { receiptDate: cursor.date, _id: { $lt: cursor.id } },
          ],
        },
      ];
    }
    const receipts = await GoodsReceipt.find(filter)
      .select(LIST_FIELDS)
      .populate("purchaseOrder", "orderNo orderDate status")
      .populate("supplier", "code businessName status")
      .populate("warehouse", "name code status")
      .sort({ receiptDate: -1, _id: -1 })
      .limit(limit + 1)
      .maxTimeMS(5000)
      .lean();
    const hasMore = receipts.length > limit;
    if (hasMore) receipts.pop();
    return res.json({
      count: receipts.length,
      hasMore,
      nextCursor:
        hasMore && receipts.length
          ? encodeCursor(receipts[receipts.length - 1])
          : null,
      goodsReceipts: receipts,
    });
  } catch (error) {
    return sendError(res, error, "Failed to load goods receipts.");
  }
};

export const getGoodsReceiptSummary = async (req, res) => {
  try {
    const filter = buildListFilter(req.query);
    const [summary] = await GoodsReceipt.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          receiptCount: { $sum: 1 },
          draftCount: { $sum: { $cond: [{ $eq: ["$status", "draft"] }, 1, 0] } },
          submittedCount: { $sum: { $cond: [{ $eq: ["$status", "submitted"] }, 1, 0] } },
          approvedCount: { $sum: { $cond: [{ $eq: ["$status", "approved"] }, 1, 0] } },
          postedCount: { $sum: { $cond: [{ $eq: ["$status", "posted"] }, 1, 0] } },
          reversedCount: { $sum: { $cond: [{ $eq: ["$status", "reversed"] }, 1, 0] } },
          totalReceivedQuantity: { $sum: "$totalReceivedQuantity" },
          totalAcceptedQuantity: { $sum: "$totalAcceptedQuantity" },
          totalQuarantineQuantity: { $sum: "$totalQuarantineQuantity" },
          totalRejectedQuantity: { $sum: "$totalRejectedQuantity" },
          totalAcceptedValue: { $sum: "$totalAcceptedValue" },
        },
      },
      { $project: { _id: 0 } },
    ]).option({ maxTimeMS: 5000 });
    return res.json({
      summary: summary || {
        receiptCount: 0,
        draftCount: 0,
        submittedCount: 0,
        approvedCount: 0,
        postedCount: 0,
        reversedCount: 0,
        totalReceivedQuantity: 0,
        totalAcceptedQuantity: 0,
        totalQuarantineQuantity: 0,
        totalRejectedQuantity: 0,
        totalAcceptedValue: 0,
      },
    });
  } catch (error) {
    return sendError(res, error, "Failed to load goods-receipt summary.");
  }
};

export const listGoodsReceiptOptions = async (req, res) => {
  try {
    const limit = parseLimit(req.query.limit, 30, 100);
    const filter = { status: "posted" };
    if (isId(req.query.supplier)) filter.supplier = req.query.supplier;
    if (isId(req.query.purchaseOrder)) filter.purchaseOrder = req.query.purchaseOrder;
    if (isId(req.query.warehouse)) filter.warehouse = req.query.warehouse;
    const q = clean(req.query.q);
    if (q) filter.receiptNo = new RegExp(`^${escapeRegex(q.toUpperCase())}`);

    const receipts = await GoodsReceipt.find(filter)
      .select([
        "receiptNo",
        "receiptDate",
        "purchaseOrder",
        "supplier",
        "supplierSnapshot",
        "warehouse",
        "currency",
        "status",
        "lines._id",
        "lines.purchaseOrderLine",
        "lines.product",
        "lines.purchaseUnit",
        "lines.productSnapshot",
        "lines.unitSnapshot",
        "lines.acceptedQuantity",
        "lines.quarantineQuantity",
        "lines.returnedAvailableQuantity",
        "lines.returnedQuarantineQuantity",
        "lines.unitCost",
        "lines.acceptedLocation",
        "lines.quarantineLocation",
        "lines.lotNumber",
      ].join(" "))
      .populate("purchaseOrder", "orderNo status")
      .populate("supplier", "code businessName status")
      .populate("warehouse", "name code status")
      .sort({ receiptDate: -1, _id: -1 })
      .limit(limit)
      .maxTimeMS(4000)
      .lean();

    const options = receipts
      .map((receipt) => ({
        ...receipt,
        lines: (receipt.lines || [])
          .map((line) => ({
            ...line,
            returnableAvailableQuantity: roundQuantity(
              Number(line.acceptedQuantity || 0) -
                Number(line.returnedAvailableQuantity || 0)
            ),
            returnableQuarantineQuantity: roundQuantity(
              Number(line.quarantineQuantity || 0) -
                Number(line.returnedQuarantineQuantity || 0)
            ),
          }))
          .filter(
            (line) =>
              line.returnableAvailableQuantity > 0 ||
              line.returnableQuarantineQuantity > 0
          ),
      }))
      .filter((receipt) => receipt.lines.length > 0);

    return res.json({ count: options.length, goodsReceipts: options });
  } catch (error) {
    return sendError(res, error, "Failed to load goods-receipt options.");
  }
};

export const getGoodsReceipt = async (req, res) => {
  try {
    if (!isId(req.params.id)) {
      return res.status(400).json({ message: "Invalid goods-receipt ID." });
    }
    const receipt = await populateReceipt(GoodsReceipt.findById(req.params.id))
      .maxTimeMS(5000)
      .lean();
    if (!receipt) return res.status(404).json({ message: "Goods receipt not found." });
    return res.json({ goodsReceipt: receipt });
  } catch (error) {
    return sendError(res, error, "Failed to load goods receipt.");
  }
};

export const createGoodsReceipt = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    const actorId = req.user?._id || null;
    const payload = buildPayload(req.body);
    payload.receiptDate = payload.receiptDate || new Date();
    payload.idempotencyKey =
      clean(req.headers["idempotency-key"] || payload.idempotencyKey) || "";
    const errors = validatePayload(payload);
    if (errors.length) return res.status(400).json({ message: errors[0], errors });

    let receipt;
    await runTransaction(session, async () => {
      if (payload.idempotencyKey) {
        const existing = await GoodsReceipt.findOne({
          idempotencyKey: payload.idempotencyKey,
        }).session(session);
        if (existing) {
          receipt = existing;
          return;
        }
      }
      const enriched = await loadAndEnrichReferences(payload, { session });
      const receiptNo = await nextDocumentNumber({
        prefix: "GRN",
        date: enriched.receiptDate,
        session,
      });
      receipt = new GoodsReceipt({
        ...enriched,
        order: undefined,
        receiptNo,
        status: "draft",
        createdBy: actorId,
        updatedBy: actorId,
      });
      await receipt.save({ session });
    });

    const populated = await populateReceipt(GoodsReceipt.findById(receipt._id)).lean();
    return res.status(201).json({
      message: "Goods-receipt draft created.",
      goodsReceipt: populated,
    });
  } catch (error) {
    return sendError(res, error, "Failed to create goods receipt.");
  } finally {
    await session.endSession();
  }
};

export const updateGoodsReceipt = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    if (!isId(req.params.id)) {
      return res.status(400).json({ message: "Invalid goods-receipt ID." });
    }
    const payload = buildPayload(req.body);
    const editableKeys = Object.keys(payload).filter((key) => key !== "idempotencyKey");
    if (!editableKeys.length) {
      return res.status(400).json({ message: "No valid goods-receipt fields were provided." });
    }
    const errors = validatePayload(payload, { partial: true });
    if (errors.length) return res.status(400).json({ message: errors[0], errors });

    let receipt;
    await runTransaction(session, async () => {
      const current = await GoodsReceipt.findById(req.params.id).session(session);
      if (!current) throw Object.assign(new Error("Goods receipt not found."), { statusCode: 404 });
      if (!GOODS_RECEIPT_EDITABLE_STATUSES.includes(current.status)) {
        throw Object.assign(new Error("Only a draft goods receipt can be edited."), {
          statusCode: 409,
        });
      }
      if (req.body.version !== undefined && Number(req.body.version) !== current.__v) {
        throw Object.assign(
          new Error("The goods receipt changed after it was opened. Reload it and try again."),
          { statusCode: 409 }
        );
      }
      const candidate = {
        ...current.toObject(),
        ...payload,
        purchaseOrder: payload.purchaseOrder ?? current.purchaseOrder,
        supplier: payload.supplier ?? current.supplier,
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
      current.currency = enriched.currency;
      current.updatedBy = req.user?._id || null;
      await current.save({ session });
      receipt = current;
    });

    const populated = await populateReceipt(GoodsReceipt.findById(receipt._id)).lean();
    return res.json({ message: "Goods-receipt draft updated.", goodsReceipt: populated });
  } catch (error) {
    return sendError(res, error, "Failed to update goods receipt.");
  } finally {
    await session.endSession();
  }
};

export const submitGoodsReceipt = async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(400).json({ message: "Invalid goods-receipt ID." });
    const receipt = await GoodsReceipt.findOne({ _id: req.params.id, status: "draft" });
    if (!receipt) return res.status(409).json({ message: "Only a draft goods receipt can be submitted." });
    receipt.status = "submitted";
    receipt.submittedAt = new Date();
    receipt.submittedBy = req.user?._id || null;
    receipt.updatedBy = req.user?._id || null;
    await receipt.save();
    return res.json({ message: "Goods receipt submitted for approval.", goodsReceipt: receipt });
  } catch (error) {
    return sendError(res, error, "Failed to submit goods receipt.");
  }
};

export const approveGoodsReceipt = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    if (!isId(req.params.id)) return res.status(400).json({ message: "Invalid goods-receipt ID." });
    let receipt;
    await runTransaction(session, async () => {
      receipt = await GoodsReceipt.findOne({
        _id: req.params.id,
        status: "submitted",
      }).session(session);
      if (!receipt) {
        throw Object.assign(new Error("Only a submitted goods receipt can be approved."), {
          statusCode: 409,
        });
      }
      await loadAndEnrichReferences(receipt.toObject(), { session });
      receipt.status = "approved";
      receipt.approvedAt = new Date();
      receipt.approvedBy = req.user?._id || null;
      receipt.updatedBy = req.user?._id || null;
      await receipt.save({ session });
    });
    return res.json({ message: "Goods receipt approved.", goodsReceipt: receipt });
  } catch (error) {
    return sendError(res, error, "Failed to approve goods receipt.");
  } finally {
    await session.endSession();
  }
};

export const postGoodsReceipt = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    if (!isId(req.params.id)) return res.status(400).json({ message: "Invalid goods-receipt ID." });
    const actorId = req.user?._id || null;
    let receipt;
    let movement;

    await runTransaction(session, async () => {
      receipt = await GoodsReceipt.findById(req.params.id).session(session);
      if (!receipt) throw Object.assign(new Error("Goods receipt not found."), { statusCode: 404 });
      if (receipt.status === "posted") {
        movement = receipt.movement
          ? await StockMovement.findById(receipt.movement).session(session)
          : null;
        return;
      }
      if (receipt.status !== "approved") {
        throw Object.assign(new Error("Only an approved goods receipt can be posted."), {
          statusCode: 409,
        });
      }

      const enriched = await loadAndEnrichReferences(receipt.toObject(), { session });
      receipt.lines = enriched.lines;
      const stockLines = movementLinesFromReceipt(receipt);
      if (stockLines.length) {
        const movementKey = `GRN:${receipt._id}:POST`;
        movement = await StockMovement.findOne({ idempotencyKey: movementKey }).session(session);
        if (!movement) {
          await StockMovement.validateDraftLines(stockLines, { session });
          movement = new StockMovement({
            movementDate: receipt.receiptDate,
            movementType: "purchase_receipt",
            status: "draft",
            reference: receipt.receiptNo,
            sourceType: "goods_receipt",
            sourceId: receipt._id,
            idempotencyKey: movementKey,
            currency: receipt.currency,
            reason: `Purchase receipt against ${enriched.order.orderNo}`,
            notes: `System-generated stock movement for ${receipt.receiptNo}.`,
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
      }

      await updatePurchaseOrderReceiptState({
        order: enriched.order,
        receiptLines: receipt.lines,
        direction: 1,
        userId: actorId,
        session,
      });

      receipt.status = "posted";
      receipt.movement = movement?._id || null;
      receipt.postedAt = new Date();
      receipt.postedBy = actorId;
      receipt.updatedBy = actorId;
      await receipt.save({ session });
    });

    const populated = await populateReceipt(GoodsReceipt.findById(receipt._id)).lean();
    return res.json({
      message: movement
        ? "Goods receipt posted and inventory updated."
        : "Rejected-only goods receipt posted without changing inventory.",
      goodsReceipt: populated,
      movement,
    });
  } catch (error) {
    return sendError(res, error, "Failed to post goods receipt.");
  } finally {
    await session.endSession();
  }
};

export const reverseGoodsReceipt = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    if (!isId(req.params.id)) return res.status(400).json({ message: "Invalid goods-receipt ID." });
    const reason = clean(req.body.reason);
    if (!reason) return res.status(400).json({ message: "Reversal reason is required." });
    const actorId = req.user?._id || null;
    let receipt;
    let reversal;

    await runTransaction(session, async () => {
      receipt = await GoodsReceipt.findById(req.params.id).session(session);
      if (!receipt) throw Object.assign(new Error("Goods receipt not found."), { statusCode: 404 });
      if (receipt.status === "reversed") {
        reversal = receipt.reversalMovement
          ? await StockMovement.findById(receipt.reversalMovement).session(session)
          : null;
        return;
      }
      if (receipt.status !== "posted") {
        throw Object.assign(new Error("Only a posted goods receipt can be reversed."), {
          statusCode: 409,
        });
      }
      const postedReturn = await PurchaseReturn.exists({
        goodsReceipt: receipt._id,
        status: "posted",
      }).session(session);
      if (postedReturn) {
        throw Object.assign(
          new Error("Reverse posted purchase returns for this goods receipt before reversing the receipt."),
          { statusCode: 409 }
        );
      }

      const order = await PurchaseOrder.findById(receipt.purchaseOrder).session(session);
      if (!order) throw Object.assign(new Error("Related purchase order not found."), { statusCode: 409 });
      if (receipt.movement) {
        reversal = await StockMovement.reverseMovementDocument({
          movementId: receipt.movement,
          userId: actorId,
          reason,
          session,
        });
      }
      await updatePurchaseOrderReceiptState({
        order,
        receiptLines: receipt.lines,
        direction: -1,
        userId: actorId,
        session,
      });
      receipt.status = "reversed";
      receipt.reversalMovement = reversal?._id || null;
      receipt.reversedAt = new Date();
      receipt.reversedBy = actorId;
      receipt.reversalReason = reason;
      receipt.updatedBy = actorId;
      await receipt.save({ session });
    });

    const populated = await populateReceipt(GoodsReceipt.findById(receipt._id)).lean();
    return res.json({
      message: reversal
        ? "Goods receipt reversed with a compensating stock movement."
        : "Rejected-only goods receipt reversed.",
      goodsReceipt: populated,
      reversalMovement: reversal,
    });
  } catch (error) {
    return sendError(res, error, "Failed to reverse goods receipt.");
  } finally {
    await session.endSession();
  }
};

export const cancelGoodsReceipt = async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(400).json({ message: "Invalid goods-receipt ID." });
    const reason = clean(req.body.reason);
    if (!reason) return res.status(400).json({ message: "Cancellation reason is required." });
    const receipt = await GoodsReceipt.findOne({
      _id: req.params.id,
      status: { $in: ["draft", "submitted", "approved"] },
      movement: null,
    });
    if (!receipt) {
      return res.status(409).json({ message: "This goods receipt cannot be cancelled in its current status." });
    }
    receipt.status = "cancelled";
    receipt.cancelledAt = new Date();
    receipt.cancelledBy = req.user?._id || null;
    receipt.cancellationReason = reason;
    receipt.updatedBy = req.user?._id || null;
    await receipt.save();
    return res.json({ message: "Goods receipt cancelled.", goodsReceipt: receipt });
  } catch (error) {
    return sendError(res, error, "Failed to cancel goods receipt.");
  }
};

export const deleteGoodsReceipt = async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(400).json({ message: "Invalid goods-receipt ID." });
    const receipt = await GoodsReceipt.findOneAndDelete({
      _id: req.params.id,
      status: { $in: ["draft", "cancelled"] },
      movement: null,
    });
    if (!receipt) {
      return res.status(409).json({
        message: "Only an unposted draft or cancelled goods receipt can be deleted.",
      });
    }
    return res.json({ message: "Goods receipt deleted." });
  } catch (error) {
    return sendError(res, error, "Failed to delete goods receipt.");
  }
};
