import mongoose from "mongoose";
import Product from "../models/inventory/product.model.js";
import InventoryUnit from "../models/inventory/inventoryUnit.model.js";
import Warehouse from "../models/inventory/warehouse.model.js";
import WarehouseLocation from "../models/inventory/warehouseLocation.model.js";
import Supplier, {
  SupplierProduct,
} from "../models/supplier.model.js";
import GoodsReceipt from "../models/goodsReceipt.model.js";
import PurchaseOrder, {
  DISCOUNT_TYPES,
  PURCHASE_ORDER_EDITABLE_STATUSES,
  PURCHASE_ORDER_OPEN_STATUSES,
  PURCHASE_ORDER_STATUSES,
  TAX_TYPES,
  roundMoney,
  roundQuantity,
} from "../models/purchaseOrder.model.js";

const LIST_FIELDS = [
  "orderNo",
  "orderDate",
  "expectedDeliveryDate",
  "supplier",
  "supplierSnapshot",
  "defaultWarehouse",
  "currency",
  "paymentTermType",
  "paymentTermDays",
  "lineCount",
  "totalOrderedQuantity",
  "totalReceivedQuantity",
  "totalReturnedQuantity",
  "subtotal",
  "discountTotal",
  "taxTotal",
  "grandTotal",
  "status",
  "revision",
  "submittedAt",
  "approvedAt",
  "createdBy",
  "updatedAt",
].join(" ");

const clean = (value) => String(value ?? "").trim();
let transactionSupport;
const supportsTransactions = async () => {
  if (transactionSupport !== undefined) return transactionSupport;
  try {
    const hello = await mongoose.connection.db.admin().command({ hello: 1 });
    transactionSupport = Boolean(hello?.setName || hello?.msg === "isdbgrid");
  } catch {
    transactionSupport = false;
  }
  return transactionSupport;
};
const runTransaction = async (work) => {
  if (!(await supportsTransactions())) return work(null);
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await work(session);
    }, {
      readConcern: { level: "snapshot" },
      writeConcern: { w: "majority" },
    });
    return result;
  } finally {
    await session.endSession();
  }
};
const sessionOptions = (session) => (session ? { session } : {});
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

const encodeCursor = (order) =>
  Buffer.from(
    JSON.stringify({
      d: new Date(order.orderDate).toISOString(),
      id: String(order._id),
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
      { upsert: true, returnDocument: "after", ...sessionOptions(session) }
    );

  const sequence = result?.sequence ?? result?.value?.sequence;
  if (!Number.isFinite(sequence)) {
    throw Object.assign(new Error("Failed to allocate a purchase-order number."), {
      statusCode: 500,
    });
  }
  return `${prefix}-${year}-${String(sequence).padStart(4, "0")}`;
};

const buildLinePayload = (line = {}) => ({
  _id: isId(line._id) ? line._id : undefined,
  product: nullableId(line.product),
  supplierProduct: nullableId(line.supplierProduct),
  purchaseUnit: nullableId(line.purchaseUnit),
  destinationWarehouse: nullableId(line.destinationWarehouse),
  destinationLocation: nullableId(line.destinationLocation),
  supplierSku: clean(line.supplierSku).toUpperCase(),
  description: clean(line.description),
  orderedQuantity: parseNumber(line.orderedQuantity ?? line.quantity),
  unitPrice: parseNumber(line.unitPrice) ?? 0,
  discountType: clean(line.discountType || "none").toLowerCase(),
  discountValue: parseNumber(line.discountValue) ?? 0,
  taxType: clean(line.taxType || "none").toLowerCase(),
  taxRate: parseNumber(line.taxRate) ?? 0,
  notes: clean(line.notes),
});

const buildPayload = (body = {}) => {
  const payload = {};

  if (body.orderDate !== undefined) payload.orderDate = parseDate(body.orderDate);
  if (body.expectedDeliveryDate !== undefined) {
    payload.expectedDeliveryDate = body.expectedDeliveryDate
      ? parseDate(body.expectedDeliveryDate)
      : null;
  }

  for (const field of ["supplier", "defaultWarehouse", "defaultLocation"]) {
    if (body[field] !== undefined) payload[field] = nullableId(body[field]);
  }

  for (const field of [
    "supplierQuotationRef",
    "supplierReference",
    "paymentTermType",
    "incoterm",
    "notes",
    "termsAndConditions",
    "idempotencyKey",
  ]) {
    if (body[field] !== undefined) payload[field] = clean(body[field]);
  }

  if (body.currency !== undefined) {
    payload.currency = clean(body.currency || "BDT").toUpperCase();
  }

  for (const field of [
    "exchangeRate",
    "paymentTermDays",
    "shippingCost",
    "otherCost",
  ]) {
    if (body[field] !== undefined) payload[field] = parseNumber(body[field]);
  }

  if (body.shippingAddress !== undefined) {
    payload.shippingAddress = {
      label: clean(body.shippingAddress?.label),
      addressLine1: clean(body.shippingAddress?.addressLine1),
      addressLine2: clean(body.shippingAddress?.addressLine2),
      city: clean(body.shippingAddress?.city),
      state: clean(body.shippingAddress?.state),
      postalCode: clean(body.shippingAddress?.postalCode),
      country: clean(body.shippingAddress?.country || "Bangladesh") || "Bangladesh",
    };
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
  if ((!partial || payload.orderDate !== undefined) && !payload.orderDate) {
    errors.push("A valid purchase-order date is required.");
  }
  if ((!partial || payload.supplier !== undefined) && !payload.supplier) {
    errors.push("A valid supplier is required.");
  }
  if (
    (!partial || payload.lines !== undefined) &&
    (!Array.isArray(payload.lines) || !payload.lines.length)
  ) {
    errors.push("At least one purchase-order line is required.");
  }
  if (Array.isArray(payload.lines) && payload.lines.length > 500) {
    errors.push("A purchase order cannot contain more than 500 lines.");
  }
  if (payload.exchangeRate !== undefined && (!Number.isFinite(payload.exchangeRate) || payload.exchangeRate <= 0)) {
    errors.push("Exchange rate must be greater than zero.");
  }
  for (const field of ["paymentTermDays", "shippingCost", "otherCost"]) {
    if (payload[field] !== undefined && (!Number.isFinite(payload[field]) || payload[field] < 0)) {
      errors.push(`${field} must be a valid non-negative number.`);
    }
  }

  for (let index = 0; index < (payload.lines || []).length; index += 1) {
    const line = payload.lines[index];
    const label = `Line ${index + 1}`;
    if (!line.product) errors.push(`${label}: product is required.`);
    if (!Number.isFinite(line.orderedQuantity) || line.orderedQuantity <= 0) {
      errors.push(`${label}: ordered quantity must be greater than zero.`);
    }
    if (!Number.isFinite(line.unitPrice) || line.unitPrice < 0) {
      errors.push(`${label}: unit price must be a valid non-negative number.`);
    }
    if (!DISCOUNT_TYPES.includes(line.discountType)) {
      errors.push(`${label}: discount type is invalid.`);
    }
    if (!Number.isFinite(line.discountValue) || line.discountValue < 0) {
      errors.push(`${label}: discount value must be non-negative.`);
    }
    if (line.discountType === "percent" && line.discountValue > 100) {
      errors.push(`${label}: percentage discount cannot exceed 100%.`);
    }
    if (!TAX_TYPES.includes(line.taxType)) {
      errors.push(`${label}: tax type is invalid.`);
    }
    if (!Number.isFinite(line.taxRate) || line.taxRate < 0 || line.taxRate > 100) {
      errors.push(`${label}: tax rate must be between 0 and 100.`);
    }
    for (const field of [
      "supplierProduct",
      "purchaseUnit",
      "destinationWarehouse",
      "destinationLocation",
    ]) {
      if (line[field] === undefined) errors.push(`${label}: ${field} is invalid.`);
    }
  }
  return errors;
};

const validateAndEnrichReferences = async (payload, { session = null } = {}) => {
  const supplierQuery = Supplier.findOne({
    _id: payload.supplier,
    status: "active",
  }).select("code businessName primaryEmail primaryPhone procurement status");
  if (session) supplierQuery.session(session);
  const supplier = await supplierQuery.lean();
  if (!supplier) {
    throw Object.assign(new Error("The selected supplier is unavailable or inactive."), {
      statusCode: 409,
    });
  }

  const productIds = uniqueIds(payload.lines.map((line) => line.product));
  const unitIds = uniqueIds(payload.lines.map((line) => line.purchaseUnit));
  const warehouseIds = uniqueIds([
    payload.defaultWarehouse,
    ...payload.lines.map((line) => line.destinationWarehouse),
  ]);
  const locationIds = uniqueIds([
    payload.defaultLocation,
    ...payload.lines.map((line) => line.destinationLocation),
  ]);
  const mappingIds = uniqueIds(payload.lines.map((line) => line.supplierProduct));

  const productQuery = Product.find({
    _id: { $in: productIds },
    status: { $ne: "archived" },
  }).select("name sku purchasePrice currency baseUnit status productType");
  const unitQuery = InventoryUnit.find({
    _id: { $in: unitIds },
    status: "active",
  }).select("name code symbol status");
  const warehouseQuery = Warehouse.find({
    _id: { $in: warehouseIds },
    status: "active",
  }).select("name code status");
  const locationQuery = WarehouseLocation.find({
    _id: { $in: locationIds },
    status: "active",
  }).select("name code warehouse status isQuarantine");
  const mappingQuery = SupplierProduct.find({
    _id: { $in: mappingIds },
    supplier: payload.supplier,
    status: "active",
  }).select("supplier product purchaseUnit supplierSku unitPrice currency taxType taxRate status");

  for (const query of [productQuery, unitQuery, warehouseQuery, locationQuery, mappingQuery]) {
    if (session) query.session(session);
  }

  let products;
  let units;
  let warehouses;
  let locations;
  let mappings;

  if (session) {
    products = await productQuery.lean();
    units = await unitQuery.lean();
    warehouses = await warehouseQuery.lean();
    locations = await locationQuery.lean();
    mappings = await mappingQuery.lean();
  } else {
    [products, units, warehouses, locations, mappings] = await Promise.all([
      productQuery.lean(),
      unitQuery.lean(),
      warehouseQuery.lean(),
      locationQuery.lean(),
      mappingQuery.lean(),
    ]);
  }

  if (products.length !== productIds.length) {
    throw Object.assign(new Error("One or more selected products are unavailable."), {
      statusCode: 409,
    });
  }
  if (units.length !== unitIds.length) {
    throw Object.assign(new Error("One or more selected purchase units are unavailable."), {
      statusCode: 409,
    });
  }
  if (warehouses.length !== warehouseIds.length) {
    throw Object.assign(new Error("One or more selected warehouses are unavailable."), {
      statusCode: 409,
    });
  }
  if (locations.length !== locationIds.length) {
    throw Object.assign(new Error("One or more selected warehouse locations are unavailable."), {
      statusCode: 409,
    });
  }
  if (mappings.length !== mappingIds.length) {
    throw Object.assign(new Error("One or more supplier-product links are unavailable."), {
      statusCode: 409,
    });
  }

  const productMap = new Map(products.map((item) => [String(item._id), item]));
  const unitMap = new Map(units.map((item) => [String(item._id), item]));
  const derivedUnitIds = uniqueIds([
    ...unitIds,
    ...products.map((item) => item.baseUnit),
    ...mappings.map((item) => item.purchaseUnit),
  ]);
  const missingUnitIds = derivedUnitIds.filter((id) => !unitMap.has(String(id)));
  if (missingUnitIds.length) {
    const missingUnitQuery = InventoryUnit.find({
      _id: { $in: missingUnitIds },
      status: "active",
    }).select("name code symbol status");
    if (session) missingUnitQuery.session(session);
    const missingUnits = await missingUnitQuery.lean();
    if (missingUnits.length !== missingUnitIds.length) {
      throw Object.assign(new Error("One or more derived purchase units are unavailable."), {
        statusCode: 409,
      });
    }
    for (const unit of missingUnits) unitMap.set(String(unit._id), unit);
  }
  const warehouseMap = new Map(warehouses.map((item) => [String(item._id), item]));
  const locationMap = new Map(locations.map((item) => [String(item._id), item]));
  const mappingMap = new Map(mappings.map((item) => [String(item._id), item]));

  if (payload.defaultLocation) {
    const defaultLocation = locationMap.get(String(payload.defaultLocation));
    if (!payload.defaultWarehouse || String(defaultLocation?.warehouse) !== String(payload.defaultWarehouse)) {
      throw Object.assign(new Error("The default location does not belong to the default warehouse."), {
        statusCode: 409,
      });
    }
  }

  const enrichedLines = payload.lines.map((line, index) => {
    const product = productMap.get(String(line.product));
    const mapping = line.supplierProduct
      ? mappingMap.get(String(line.supplierProduct))
      : null;

    if (mapping && String(mapping.product) !== String(line.product)) {
      throw Object.assign(
        new Error(`Line ${index + 1}: supplier-product link does not match the selected product.`),
        { statusCode: 409 }
      );
    }

    const purchaseUnit = line.purchaseUnit || mapping?.purchaseUnit || product?.baseUnit || null;
    if (purchaseUnit && !unitMap.has(String(purchaseUnit))) {
      throw Object.assign(new Error(`Line ${index + 1}: purchase unit is unavailable.`), {
        statusCode: 409,
      });
    }

    const destinationWarehouse = line.destinationWarehouse || payload.defaultWarehouse || null;
    const destinationLocation = line.destinationLocation || payload.defaultLocation || null;
    if (!destinationWarehouse) {
      throw Object.assign(new Error(`Line ${index + 1}: destination warehouse is required.`), {
        statusCode: 400,
      });
    }
    if (!warehouseMap.has(String(destinationWarehouse))) {
      throw Object.assign(new Error(`Line ${index + 1}: destination warehouse is unavailable.`), {
        statusCode: 409,
      });
    }
    if (destinationLocation) {
      const location = locationMap.get(String(destinationLocation));
      if (!location || String(location.warehouse) !== String(destinationWarehouse)) {
        throw Object.assign(
          new Error(`Line ${index + 1}: destination location does not belong to its warehouse.`),
          { statusCode: 409 }
        );
      }
    }

    const unit = purchaseUnit ? unitMap.get(String(purchaseUnit)) : null;
    return {
      ...line,
      purchaseUnit,
      destinationWarehouse,
      destinationLocation,
      supplierSku: line.supplierSku || mapping?.supplierSku || "",
      unitPrice: roundMoney(
        Number.isFinite(line.unitPrice)
          ? line.unitPrice
          : mapping?.unitPrice ?? product?.purchasePrice ?? 0
      ),
      taxType: line.taxType || mapping?.taxType || "none",
      taxRate: Number.isFinite(line.taxRate) ? line.taxRate : mapping?.taxRate || 0,
      productSnapshot: { code: product.sku || "", name: product.name || "" },
      unitSnapshot: { code: unit?.code || unit?.symbol || "", name: unit?.name || "" },
    };
  });

  return {
    ...payload,
    supplierSnapshot: {
      code: supplier.code || "",
      name: supplier.businessName || "",
      email: supplier.primaryEmail || "",
      phone: supplier.primaryPhone || "",
    },
    currency: payload.currency || supplier.procurement?.currency || "BDT",
    paymentTermType:
      payload.paymentTermType || supplier.procurement?.paymentTermType || "immediate",
    paymentTermDays:
      payload.paymentTermDays ?? supplier.procurement?.paymentTermDays ?? 0,
    incoterm: payload.incoterm || supplier.procurement?.incoterm || "",
    lines: enrichedLines,
  };
};

const duplicateMessage = (error) => {
  const fields = Object.keys(error?.keyPattern || error?.keyValue || {});
  if (fields.includes("orderNo")) return "A purchase order with this number already exists.";
  if (fields.includes("idempotencyKey")) return "This purchase-order request already exists.";
  return "A duplicate purchase order already exists.";
};

const sendError = (res, error, fallbackMessage) => {
  if (error?.code === 11000) {
    return res.status(409).json({ message: duplicateMessage(error) });
  }
  if (error?.name === "ValidationError" || error?.name === "CastError") {
    return res.status(400).json({ message: error.message });
  }
  if (error?.name === "VersionError") {
    return res.status(409).json({
      message: "The purchase order changed after it was opened. Reload it and try again.",
    });
  }
  return res.status(error?.statusCode || 500).json({
    message: error?.statusCode ? error.message : fallbackMessage,
    ...(process.env.NODE_ENV !== "production" ? { error: error.message } : {}),
  });
};

const populateOrder = (query) =>
  query
    .populate("supplier", "code businessName primaryEmail primaryPhone status")
    .populate("defaultWarehouse", "name code status")
    .populate("defaultLocation", "name code warehouse status")
    .populate("lines.product", "name sku barcode productType status")
    .populate("lines.purchaseUnit", "name code symbol status")
    .populate("lines.destinationWarehouse", "name code status")
    .populate("lines.destinationLocation", "name code warehouse status")
    .populate("submittedBy", "name email")
    .populate("approvedBy", "name email")
    .populate("createdBy", "name email");

const buildListFilter = (query = {}) => {
  const filter = {};
  if (query.status && query.status !== "all") {
    const status = clean(query.status).toLowerCase();
    if (!PURCHASE_ORDER_STATUSES.includes(status)) {
      throw Object.assign(new Error("Purchase-order status filter is invalid."), {
        statusCode: 400,
      });
    }
    filter.status = status;
  }
  if (isId(query.supplier)) filter.supplier = query.supplier;
  if (isId(query.warehouse)) {
    filter.$or = [
      { defaultWarehouse: query.warehouse },
      { "lines.destinationWarehouse": query.warehouse },
    ];
  }
  if (isId(query.product)) filter["lines.product"] = query.product;
  if (clean(query.currency)) filter.currency = clean(query.currency).toUpperCase();

  const from = parseDate(query.dateFrom);
  const to = parseDate(query.dateTo);
  if (from || to) {
    filter.orderDate = {};
    if (from) filter.orderDate.$gte = from;
    if (to) {
      to.setHours(23, 59, 59, 999);
      filter.orderDate.$lte = to;
    }
  }

  const q = clean(query.q);
  if (q) {
    const prefix = new RegExp(`^${escapeRegex(q.toUpperCase())}`);
    filter.orderNo = prefix;
  }
  return filter;
};

export const getPurchaseOrderMeta = async (_req, res) =>
  res.json({
    statuses: PURCHASE_ORDER_STATUSES,
    editableStatuses: PURCHASE_ORDER_EDITABLE_STATUSES,
    openStatuses: PURCHASE_ORDER_OPEN_STATUSES,
    discountTypes: DISCOUNT_TYPES,
    taxTypes: TAX_TYPES,
  });

export const listPurchaseOrders = async (req, res) => {
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
            { orderDate: { $lt: cursor.date } },
            { orderDate: cursor.date, _id: { $lt: cursor.id } },
          ],
        },
      ];
    }

    const orders = await PurchaseOrder.find(filter)
      .select(LIST_FIELDS)
      .populate("supplier", "code businessName status")
      .populate("defaultWarehouse", "name code status")
      .sort({ orderDate: -1, _id: -1 })
      .limit(limit + 1)
      .maxTimeMS(5000)
      .lean();

    const hasMore = orders.length > limit;
    if (hasMore) orders.pop();
    return res.json({
      count: orders.length,
      hasMore,
      nextCursor:
        hasMore && orders.length ? encodeCursor(orders[orders.length - 1]) : null,
      purchaseOrders: orders,
    });
  } catch (error) {
    return sendError(res, error, "Failed to load purchase orders.");
  }
};

export const getPurchaseOrderSummary = async (req, res) => {
  try {
    const filter = buildListFilter(req.query);
    const [summary] = await PurchaseOrder.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          orderCount: { $sum: 1 },
          draftCount: { $sum: { $cond: [{ $eq: ["$status", "draft"] }, 1, 0] } },
          submittedCount: { $sum: { $cond: [{ $eq: ["$status", "submitted"] }, 1, 0] } },
          approvedCount: { $sum: { $cond: [{ $eq: ["$status", "approved"] }, 1, 0] } },
          partialCount: { $sum: { $cond: [{ $eq: ["$status", "partially_received"] }, 1, 0] } },
          receivedCount: { $sum: { $cond: [{ $eq: ["$status", "received"] }, 1, 0] } },
          totalOrderedQuantity: { $sum: "$totalOrderedQuantity" },
          totalReceivedQuantity: { $sum: "$totalReceivedQuantity" },
          totalValue: { $sum: "$grandTotal" },
        },
      },
      { $project: { _id: 0 } },
    ]).option({ maxTimeMS: 5000 });

    return res.json({
      summary: summary || {
        orderCount: 0,
        draftCount: 0,
        submittedCount: 0,
        approvedCount: 0,
        partialCount: 0,
        receivedCount: 0,
        totalOrderedQuantity: 0,
        totalReceivedQuantity: 0,
        totalValue: 0,
      },
    });
  } catch (error) {
    return sendError(res, error, "Failed to load purchase-order summary.");
  }
};

export const listPurchaseOrderOptions = async (req, res) => {
  try {
    const limit = parseLimit(req.query.limit, 30, 100);
    const filter = {
      status: { $in: ["approved", "partially_received"] },
    };
    if (isId(req.query.supplier)) filter.supplier = req.query.supplier;
    if (isId(req.query.warehouse)) {
      filter["lines.destinationWarehouse"] = req.query.warehouse;
    }
    const q = clean(req.query.q);
    if (q) filter.orderNo = new RegExp(`^${escapeRegex(q.toUpperCase())}`);

    const orders = await PurchaseOrder.find(filter)
      .select([
        "orderNo",
        "orderDate",
        "expectedDeliveryDate",
        "supplier",
        "supplierSnapshot",
        "currency",
        "status",
        "totalOrderedQuantity",
        "totalReceivedQuantity",
        "lines._id",
        "lines.product",
        "lines.purchaseUnit",
        "lines.destinationWarehouse",
        "lines.destinationLocation",
        "lines.productSnapshot",
        "lines.unitSnapshot",
        "lines.orderedQuantity",
        "lines.receivedQuantity",
        "lines.cancelledQuantity",
        "lines.unitPrice",
      ].join(" "))
      .populate("supplier", "code businessName status")
      .sort({ orderDate: -1, _id: -1 })
      .limit(limit)
      .maxTimeMS(4000)
      .lean();

    const options = orders
      .map((order) => ({
        ...order,
        lines: (order.lines || [])
          .map((line) => ({
            ...line,
            remainingQuantity: roundQuantity(
              Number(line.orderedQuantity || 0) -
                Number(line.cancelledQuantity || 0) -
                Number(line.receivedQuantity || 0)
            ),
          }))
          .filter((line) => line.remainingQuantity > 0),
      }))
      .filter((order) => order.lines.length > 0);

    return res.json({ count: options.length, purchaseOrders: options });
  } catch (error) {
    return sendError(res, error, "Failed to load purchase-order options.");
  }
};

export const getPurchaseOrder = async (req, res) => {
  try {
    if (!isId(req.params.id)) {
      return res.status(400).json({ message: "Invalid purchase-order ID." });
    }
    const order = await populateOrder(PurchaseOrder.findById(req.params.id))
      .maxTimeMS(5000)
      .lean();
    if (!order) return res.status(404).json({ message: "Purchase order not found." });
    return res.json({ purchaseOrder: order });
  } catch (error) {
    return sendError(res, error, "Failed to load purchase order.");
  }
};

export const createPurchaseOrder = async (req, res) => {
  try {
    const actorId = req.user?._id || null;
    const payload = buildPayload(req.body);
    payload.orderDate = payload.orderDate || new Date();
    payload.currency = payload.currency || "BDT";
    payload.exchangeRate = payload.exchangeRate ?? 1;
    payload.shippingCost = payload.shippingCost ?? 0;
    payload.otherCost = payload.otherCost ?? 0;
    payload.idempotencyKey =
      clean(req.headers["idempotency-key"] || payload.idempotencyKey) || "";

    const errors = validatePayload(payload);
    if (errors.length) return res.status(400).json({ message: errors[0], errors });

    const order = await runTransaction(async (session) => {
      if (payload.idempotencyKey) {
        const existingQuery = PurchaseOrder.findOne({
          idempotencyKey: payload.idempotencyKey,
        });
        if (session) existingQuery.session(session);
        const existing = await existingQuery;
        if (existing) {
          return existing;
        }
      }

      const enriched = await validateAndEnrichReferences(payload, { session });
      const orderNo = await nextDocumentNumber({
        prefix: "PPO",
        date: enriched.orderDate,
        session,
      });
      const created = new PurchaseOrder({
        ...enriched,
        orderNo,
        status: "draft",
        createdBy: actorId,
        updatedBy: actorId,
      });
      await created.save(sessionOptions(session));
      return created;
    });

    const populated = await populateOrder(PurchaseOrder.findById(order._id)).lean();
    return res.status(201).json({
      message: order.status === "draft" ? "Purchase-order draft created." : "Purchase-order request already exists.",
      purchaseOrder: populated,
    });
  } catch (error) {
    return sendError(res, error, "Failed to create purchase order.");
  }
};

export const updatePurchaseOrder = async (req, res) => {
  try {
    if (!isId(req.params.id)) {
      return res.status(400).json({ message: "Invalid purchase-order ID." });
    }
    const actorId = req.user?._id || null;
    const payload = buildPayload(req.body);
    const editableKeys = Object.keys(payload).filter((key) => key !== "idempotencyKey");
    if (!editableKeys.length) {
      return res.status(400).json({ message: "No valid purchase-order fields were provided." });
    }
    const errors = validatePayload(payload, { partial: true });
    if (errors.length) return res.status(400).json({ message: errors[0], errors });

    const order = await runTransaction(async (session) => {
      const currentQuery = PurchaseOrder.findById(req.params.id);
      if (session) currentQuery.session(session);
      const current = await currentQuery;
      if (!current) throw Object.assign(new Error("Purchase order not found."), { statusCode: 404 });
      if (!PURCHASE_ORDER_EDITABLE_STATUSES.includes(current.status)) {
        throw Object.assign(new Error("Only a draft or rejected purchase order can be edited."), {
          statusCode: 409,
        });
      }
      if (req.body.version !== undefined && Number(req.body.version) !== current.__v) {
        throw Object.assign(
          new Error("The purchase order changed after it was opened. Reload it and try again."),
          { statusCode: 409 }
        );
      }

      const candidate = {
        ...current.toObject(),
        ...payload,
        supplier: payload.supplier ?? current.supplier,
        lines: payload.lines ?? current.lines.map((line) => line.toObject()),
        defaultWarehouse:
          payload.defaultWarehouse !== undefined
            ? payload.defaultWarehouse
            : current.defaultWarehouse,
        defaultLocation:
          payload.defaultLocation !== undefined
            ? payload.defaultLocation
            : current.defaultLocation,
      };
      const enriched = await validateAndEnrichReferences(candidate, { session });
      for (const key of Object.keys(payload)) {
        if (key === "lines") current.lines = enriched.lines;
        else if (["supplier", "defaultWarehouse", "defaultLocation"].includes(key)) {
          current[key] = enriched[key];
        } else current[key] = enriched[key] ?? payload[key];
      }
      current.supplierSnapshot = enriched.supplierSnapshot;
      current.status = "draft";
      current.rejectionReason = "";
      current.rejectedAt = null;
      current.rejectedBy = null;
      current.revision += 1;
      current.updatedBy = actorId;
      await current.save(sessionOptions(session));
      return current;
    });

    const populated = await populateOrder(PurchaseOrder.findById(order._id)).lean();
    return res.json({ message: "Purchase-order draft updated.", purchaseOrder: populated });
  } catch (error) {
    return sendError(res, error, "Failed to update purchase order.");
  }
};

export const submitPurchaseOrder = async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(400).json({ message: "Invalid purchase-order ID." });
    const order = await PurchaseOrder.findOne({
      _id: req.params.id,
      status: { $in: ["draft", "rejected"] },
    });
    if (!order) {
      return res.status(409).json({ message: "Only a draft or rejected purchase order can be submitted." });
    }
    if (!order.lines.length || order.grandTotal < 0) {
      return res.status(400).json({ message: "The purchase order is incomplete." });
    }
    order.status = "submitted";
    order.submittedAt = new Date();
    order.submittedBy = req.user?._id || null;
    order.rejectionReason = "";
    order.rejectedAt = null;
    order.rejectedBy = null;
    order.updatedBy = req.user?._id || null;
    await order.save();
    return res.json({ message: "Purchase order submitted for approval.", purchaseOrder: order });
  } catch (error) {
    return sendError(res, error, "Failed to submit purchase order.");
  }
};

export const approvePurchaseOrder = async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(400).json({ message: "Invalid purchase-order ID." });
    const order = await PurchaseOrder.findOne({ _id: req.params.id, status: "submitted" });
    if (!order) return res.status(409).json({ message: "Only a submitted purchase order can be approved." });
    order.status = "approved";
    order.approvedAt = new Date();
    order.approvedBy = req.user?._id || null;
    order.updatedBy = req.user?._id || null;
    await order.save();
    return res.json({ message: "Purchase order approved.", purchaseOrder: order });
  } catch (error) {
    return sendError(res, error, "Failed to approve purchase order.");
  }
};

export const rejectPurchaseOrder = async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(400).json({ message: "Invalid purchase-order ID." });
    const reason = clean(req.body.reason);
    if (!reason) return res.status(400).json({ message: "Rejection reason is required." });
    const order = await PurchaseOrder.findOne({ _id: req.params.id, status: "submitted" });
    if (!order) return res.status(409).json({ message: "Only a submitted purchase order can be rejected." });
    order.status = "rejected";
    order.rejectedAt = new Date();
    order.rejectedBy = req.user?._id || null;
    order.rejectionReason = reason;
    order.updatedBy = req.user?._id || null;
    await order.save();
    return res.json({ message: "Purchase order rejected.", purchaseOrder: order });
  } catch (error) {
    return sendError(res, error, "Failed to reject purchase order.");
  }
};

export const cancelPurchaseOrder = async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(400).json({ message: "Invalid purchase-order ID." });
    const reason = clean(req.body.reason);
    if (!reason) return res.status(400).json({ message: "Cancellation reason is required." });
    const order = await PurchaseOrder.findOne({
      _id: req.params.id,
      status: { $in: ["draft", "submitted", "approved", "rejected"] },
    });
    if (!order) return res.status(409).json({ message: "This purchase order cannot be cancelled in its current status." });
    if (order.totalReceivedQuantity > 0) {
      return res.status(409).json({ message: "A purchase order with received goods cannot be cancelled. Close it instead." });
    }
    const openReceipt = await GoodsReceipt.exists({
      purchaseOrder: order._id,
      status: { $in: ["draft", "submitted", "approved"] },
    });
    if (openReceipt) {
      return res.status(409).json({
        message: "Cancel the open goods receipts for this purchase order before cancelling it.",
      });
    }
    order.status = "cancelled";
    order.cancelledAt = new Date();
    order.cancelledBy = req.user?._id || null;
    order.cancellationReason = reason;
    order.updatedBy = req.user?._id || null;
    await order.save();
    return res.json({ message: "Purchase order cancelled.", purchaseOrder: order });
  } catch (error) {
    return sendError(res, error, "Failed to cancel purchase order.");
  }
};

export const closePurchaseOrder = async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(400).json({ message: "Invalid purchase-order ID." });
    const reason = clean(req.body.reason);
    const order = await PurchaseOrder.findOne({
      _id: req.params.id,
      status: { $in: ["approved", "partially_received", "received"] },
    });
    if (!order) return res.status(409).json({ message: "This purchase order cannot be closed in its current status." });
    const openReceipt = await GoodsReceipt.exists({
      purchaseOrder: order._id,
      status: { $in: ["draft", "submitted", "approved"] },
    });
    if (openReceipt) {
      return res.status(409).json({
        message: "Complete or cancel the open goods receipts before closing the purchase order.",
      });
    }
    order.status = "closed";
    order.closedAt = new Date();
    order.closedBy = req.user?._id || null;
    order.closeReason = reason;
    order.updatedBy = req.user?._id || null;
    await order.save();
    return res.json({ message: "Purchase order closed.", purchaseOrder: order });
  } catch (error) {
    return sendError(res, error, "Failed to close purchase order.");
  }
};

export const deletePurchaseOrder = async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(400).json({ message: "Invalid purchase-order ID." });
    const relatedReceipt = await GoodsReceipt.exists({
      purchaseOrder: req.params.id,
    });
    if (relatedReceipt) {
      return res.status(409).json({
        message: "A purchase order referenced by a goods receipt cannot be deleted.",
      });
    }
    const order = await PurchaseOrder.findOneAndDelete({
      _id: req.params.id,
      status: { $in: ["draft", "rejected", "cancelled"] },
      totalReceivedQuantity: 0,
    });
    if (!order) {
      return res.status(409).json({
        message: "Only an unreceived draft, rejected, or cancelled purchase order can be deleted.",
      });
    }
    return res.json({ message: "Purchase order deleted." });
  } catch (error) {
    return sendError(res, error, "Failed to delete purchase order.");
  }
};
