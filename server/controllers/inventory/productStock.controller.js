import mongoose from "mongoose";
import Product from "../../models/inventory/product.model.js";
import Warehouse from "../../models/inventory/warehouse.model.js";
import WarehouseLocation from "../../models/inventory/warehouseLocation.model.js";
import ProductStock, { STOCK_STATUSES, roundMoney, roundQuantity } from "../../models/inventory/productStock.model.js";
import StockMovement from "../../models/inventory/stockMovement.model.js";
import { runMongoTransaction, sessionOptions, withSession } from "../../utils/mongoTransaction.js";

const LIST_FIELDS = [
  "product",
  "warehouse",
  "location",
  "onHandQuantity",
  "reservedQuantity",
  "quarantineQuantity",
  "availableQuantity",
  "incomingQuantity",
  "outgoingQuantity",
  "averageCost",
  "inventoryValue",
  "reorderLevel",
  "minimumStock",
  "maximumStock",
  "lastMovementAt",
  "lastCountedAt",
  "stockVersion",
  "status",
  "updatedAt",
].join(" ");

const clean = (value) => String(value ?? "").trim();
const isId = (value) => mongoose.Types.ObjectId.isValid(String(value || ""));
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

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

export const buildOpeningStockCommand = (body = {}) => {
  const product = clean(body.product);
  const warehouse = clean(body.warehouse);
  const location = nullableId(body.location);
  const quantity = parseNumber(body.quantity);
  const stockPrice = parseNumber(body.stockPrice);
  const idempotencyKey = clean(body.idempotencyKey);

  if (!isId(product)) throw Object.assign(new Error("Select a valid product."), { statusCode: 400 });
  if (!isId(warehouse)) throw Object.assign(new Error("Select a valid warehouse."), { statusCode: 400 });
  if (location === undefined) {
    throw Object.assign(new Error("Select a valid bin or shelf, or leave it empty."), { statusCode: 400 });
  }
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw Object.assign(new Error("Quantity to add must be greater than zero."), { statusCode: 400 });
  }
  if (!Number.isFinite(stockPrice) || stockPrice < 0) {
    throw Object.assign(new Error("Stock price must be a valid non-negative number."), { statusCode: 400 });
  }

  return {
    product,
    warehouse,
    location,
    quantity: roundQuantity(quantity),
    stockPrice: roundMoney(stockPrice),
    idempotencyKey,
  };
};

export const buildOpeningStockMovement = (command, userId = null) => ({
  movementType: "opening_stock",
  sourceType: "inventory_item",
  idempotencyKey: command.idempotencyKey || undefined,
  currency: "BDT",
  reason: "Inventory Items opening stock",
  lines: [
    {
      product: command.product,
      effect: "in",
      destinationWarehouse: command.warehouse,
      destinationLocation: command.location,
      quantity: command.quantity,
      requestedUnitCost: command.stockPrice,
      note: "Created from Inventory Items",
    },
  ],
  createdBy: userId,
  updatedBy: userId,
});

const encodeCursor = (stock) =>
  Buffer.from(JSON.stringify({ id: String(stock._id) }), "utf8").toString("base64url");

const decodeCursor = (value) => {
  try {
    if (!value) return null;
    const parsed = JSON.parse(Buffer.from(String(value), "base64url").toString("utf8"));
    if (!isId(parsed?.id)) return null;
    return new mongoose.Types.ObjectId(parsed.id);
  } catch {
    return null;
  }
};

const buildStockSettingsPayload = (body = {}, userId = null) => {
  const payload = {};

  for (const field of ["reorderLevel", "minimumStock", "maximumStock"]) {
    if (body[field] !== undefined) payload[field] = parseNumber(body[field]);
  }
  if (body.lastCountedAt !== undefined) {
    const date = body.lastCountedAt ? new Date(body.lastCountedAt) : null;
    payload.lastCountedAt = date && !Number.isNaN(date.getTime()) ? date : undefined;
  }
  if (body.status !== undefined) payload.status = clean(body.status).toLowerCase();
  if (userId) payload.updatedBy = userId;

  return payload;
};

const validateSettingsPayload = (payload, current = {}) => {
  const errors = [];

  for (const field of ["reorderLevel", "minimumStock", "maximumStock"]) {
    if (payload[field] !== undefined && (!Number.isFinite(payload[field]) || payload[field] < 0)) {
      errors.push(`${field} must be a valid non-negative number.`);
    }
  }

  if (Object.prototype.hasOwnProperty.call(payload, "lastCountedAt") && payload.lastCountedAt === undefined) {
    errors.push("Last counted date must be a valid date or empty.");
  }

  if (payload.status !== undefined && !STOCK_STATUSES.includes(payload.status)) {
    errors.push("Stock status has an invalid value.");
  }
  if (payload.status === "archived") errors.push("Use the archive endpoint to archive a stock record.");

  const nextMinimum = payload.minimumStock ?? current.minimumStock ?? 0;
  const nextMaximum = payload.maximumStock ?? current.maximumStock ?? 0;
  const nextReorder = payload.reorderLevel ?? current.reorderLevel ?? 0;

  if (nextMaximum > 0 && nextMinimum > nextMaximum) {
    errors.push("Maximum stock must be greater than or equal to minimum stock.");
  }
  if (nextMaximum > 0 && nextReorder > nextMaximum) {
    errors.push("Reorder level cannot be greater than maximum stock.");
  }

  return errors;
};

const duplicateMessage = () => "A stock record already exists for this product, warehouse and location.";

const sendWriteError = (res, error, fallbackMessage) => {
  if (error?.code === 11000) {
    return res.status(409).json({ message: duplicateMessage(), error: error.message });
  }
  if (error?.name === "ValidationError" || error?.name === "CastError") {
    return res.status(400).json({ message: error.message, error: error.message });
  }
  return res.status(error?.statusCode || 500).json({
    message: error?.statusCode ? error.message : fallbackMessage,
    error: error.message,
  });
};

const validateStockReferences = async ({ productId, warehouseId, locationId = null, requireActive = true }) => {
  if (!isId(productId)) throw Object.assign(new Error("Select a valid product."), { statusCode: 400 });
  if (!isId(warehouseId)) throw Object.assign(new Error("Select a valid warehouse."), { statusCode: 400 });
  if (locationId && !isId(locationId)) {
    throw Object.assign(new Error("Select a valid warehouse location or leave it empty."), { statusCode: 400 });
  }

  const [product, warehouse, location] = await Promise.all([
    Product.findById(productId)
      .select("name sku productType status trackInventory purchasePrice reorderLevel minimumStock maximumStock allowNegativeStock")
      .maxTimeMS(3000)
      .lean(),
    Warehouse.findById(warehouseId)
      .select("name code status allowNegativeStock")
      .maxTimeMS(3000)
      .lean(),
    locationId
      ? WarehouseLocation.findById(locationId)
          .select("warehouse name code status isQuarantine")
          .maxTimeMS(3000)
          .lean()
      : Promise.resolve(null),
  ]);

  if (!product) throw Object.assign(new Error("Product was not found."), { statusCode: 404 });
  if (product.status === "archived") throw Object.assign(new Error("An archived product cannot have active stock."), { statusCode: 409 });
  if (product.productType !== "inventory" || product.trackInventory !== true) {
    throw Object.assign(new Error("Stock can only be maintained for inventory-tracked products."), { statusCode: 409 });
  }
  if (requireActive && product.status !== "active") {
    throw Object.assign(new Error("The selected product must be active."), { statusCode: 409 });
  }

  if (!warehouse) throw Object.assign(new Error("Warehouse was not found."), { statusCode: 404 });
  if (warehouse.status === "archived") throw Object.assign(new Error("An archived warehouse cannot contain active stock."), { statusCode: 409 });
  if (requireActive && warehouse.status !== "active") {
    throw Object.assign(new Error("The selected warehouse must be active."), { statusCode: 409 });
  }

  if (locationId) {
    if (!location) throw Object.assign(new Error("Warehouse location was not found."), { statusCode: 404 });
    if (String(location.warehouse) !== String(warehouseId)) {
      throw Object.assign(new Error("The selected location does not belong to the selected warehouse."), { statusCode: 409 });
    }
    if (location.status === "archived") {
      throw Object.assign(new Error("An archived location cannot contain active stock."), { statusCode: 409 });
    }
    if (requireActive && location.status !== "active") {
      throw Object.assign(new Error("The selected warehouse location must be active."), { statusCode: 409 });
    }
  }

  return { product, warehouse, location };
};

const hasAnyQuantity = (stock) =>
  [
    stock.onHandQuantity,
    stock.reservedQuantity,
    stock.quarantineQuantity,
    stock.incomingQuantity,
    stock.outgoingQuantity,
  ].some((value) => Number(value || 0) !== 0);

const buildStockFilter = async (query = {}) => {
  const filter = {};

  if (isId(query.product)) filter.product = query.product;
  if (isId(query.warehouse)) filter.warehouse = query.warehouse;
  if (query.location === "none" || query.location === "null") filter.location = null;
  else if (isId(query.location)) filter.location = query.location;

  if (query.status && query.status !== "all") filter.status = clean(query.status).toLowerCase();
  else filter.status = { $in: ["active", "inactive"] };

  if (parseBoolean(query.hasStock) === true) filter.onHandQuantity = { $gt: 0 };
  if (parseBoolean(query.outOfStock) === true) filter.availableQuantity = { $lte: 0 };
  if (parseBoolean(query.lowStock) === true) {
    filter.$expr = {
      $and: [
        { $gt: ["$reorderLevel", 0] },
        { $lte: ["$availableQuantity", "$reorderLevel"] },
      ],
    };
  }

  const q = clean(query.q);
  if (q && !filter.product) {
    const productIds = await Product.find({
      status: { $ne: "archived" },
      $or: [
        { nameLower: new RegExp(`^${escapeRegex(q.toLowerCase())}`) },
        { sku: new RegExp(`^${escapeRegex(q.toUpperCase())}`) },
        { barcode: new RegExp(`^${escapeRegex(q.toUpperCase())}`) },
      ],
    })
      .select("_id")
      .limit(250)
      .maxTimeMS(3000)
      .lean();

    filter.product = { $in: productIds.map((item) => item._id) };
  }

  return filter;
};

export const listProductStocks = async (req, res) => {
  try {
    const limit = parseLimit(req.query.limit, 40, 150);
    const cursor = decodeCursor(req.query.cursor);
    if (req.query.cursor && !cursor) return res.status(400).json({ message: "Invalid pagination cursor." });

    const filter = await buildStockFilter(req.query);
    if (cursor) filter._id = { $lt: cursor };

    const stocks = await ProductStock.find(filter)
      .select(LIST_FIELDS)
      .populate("product", "name sku barcode imageUrl baseUnit status")
      .populate("warehouse", "name code warehouseType status")
      .populate("location", "name code locationType status isQuarantine")
      .sort({ _id: -1 })
      .limit(limit + 1)
      .maxTimeMS(5000)
      .lean();

    const hasMore = stocks.length > limit;
    if (hasMore) stocks.pop();
    const nextCursor = hasMore && stocks.length ? encodeCursor(stocks.at(-1)) : null;

    return res.json({ count: stocks.length, hasMore, nextCursor, stocks });
  } catch (error) {
    return res.status(500).json({ message: "Failed to load product stock.", error: error.message });
  }
};

export const listInventoryItems = async (req, res) => {
  try {
    const limit = parseLimit(req.query.limit, 20, 100);
    const page = Math.max(1, Math.trunc(Number(req.query.page) || 1));
    const filter = await buildStockFilter(req.query);
    const pipeline = [
      { $match: filter },
      {
        $group: {
          _id: "$product",
          totalQuantity: { $sum: "$onHandQuantity" },
          availableQuantity: { $sum: "$availableQuantity" },
          stockValue: { $sum: "$inventoryValue" },
          warehouseCount: { $addToSet: "$warehouse" },
          activePositions: { $sum: { $cond: [{ $eq: ["$status", "active"] }, 1, 0] } },
          positionCount: { $sum: 1 },
        },
      },
      { $lookup: { from: "products", localField: "_id", foreignField: "_id", as: "product" } },
      { $unwind: "$product" },
      { $sort: { "product.nameLower": 1, _id: 1 } },
      {
        $facet: {
          rows: [
            { $skip: (page - 1) * limit },
            { $limit: limit },
            {
              $project: {
                _id: 0,
                product: {
                  _id: "$product._id",
                  name: "$product.name",
                  sku: "$product.sku",
                  barcode: "$product.barcode",
                  imageUrl: "$product.imageUrl",
                  status: "$product.status",
                },
                totalQuantity: 1,
                availableQuantity: 1,
                stockValue: 1,
                warehouseCount: { $size: "$warehouseCount" },
                positionCount: 1,
                status: { $cond: [{ $gt: ["$activePositions", 0] }, "active", "inactive"] },
              },
            },
          ],
          total: [{ $count: "value" }],
        },
      },
    ];

    const [result] = await ProductStock.aggregate(pipeline).option({ maxTimeMS: 5000 });
    const total = result?.total?.[0]?.value || 0;
    return res.json({
      items: result?.rows || [],
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to load inventory items.", error: error.message });
  }
};

export const getProductStockSummary = async (req, res) => {
  try {
    const match = { status: { $ne: "archived" } };
    if (isId(req.query.product)) match.product = new mongoose.Types.ObjectId(req.query.product);
    if (isId(req.query.warehouse)) match.warehouse = new mongoose.Types.ObjectId(req.query.warehouse);
    if (isId(req.query.location)) match.location = new mongoose.Types.ObjectId(req.query.location);

    const [summary, lowStockCount, outOfStockCount] = await Promise.all([
      ProductStock.aggregate([
        { $match: match },
        {
          $group: {
            _id: null,
            stockRows: { $sum: 1 },
            products: { $addToSet: "$product" },
            warehouses: { $addToSet: "$warehouse" },
            onHandQuantity: { $sum: "$onHandQuantity" },
            reservedQuantity: { $sum: "$reservedQuantity" },
            quarantineQuantity: { $sum: "$quarantineQuantity" },
            availableQuantity: { $sum: "$availableQuantity" },
            incomingQuantity: { $sum: "$incomingQuantity" },
            outgoingQuantity: { $sum: "$outgoingQuantity" },
            inventoryValue: { $sum: "$inventoryValue" },
          },
        },
        {
          $project: {
            _id: 0,
            stockRows: 1,
            productCount: { $size: "$products" },
            warehouseCount: { $size: "$warehouses" },
            onHandQuantity: 1,
            reservedQuantity: 1,
            quarantineQuantity: 1,
            availableQuantity: 1,
            incomingQuantity: 1,
            outgoingQuantity: 1,
            inventoryValue: 1,
          },
        },
      ]).option({ maxTimeMS: 5000 }),
      ProductStock.countDocuments({
        ...match,
        $expr: { $and: [{ $gt: ["$reorderLevel", 0] }, { $lte: ["$availableQuantity", "$reorderLevel"] }] },
      }).maxTimeMS(3000),
      ProductStock.countDocuments({ ...match, availableQuantity: { $lte: 0 } }).maxTimeMS(3000),
    ]);

    return res.json({
      summary: {
        ...(summary[0] || {
          stockRows: 0,
          productCount: 0,
          warehouseCount: 0,
          onHandQuantity: 0,
          reservedQuantity: 0,
          quarantineQuantity: 0,
          availableQuantity: 0,
          incomingQuantity: 0,
          outgoingQuantity: 0,
          inventoryValue: 0,
        }),
        lowStockCount,
        outOfStockCount,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to load stock summary.", error: error.message });
  }
};

export const getProductAvailability = async (req, res) => {
  try {
    if (!isId(req.params.productId)) return res.status(400).json({ message: "Invalid product ID." });

    const filter = { product: req.params.productId, status: { $ne: "archived" } };
    if (isId(req.query.warehouse)) filter.warehouse = req.query.warehouse;

    const stocks = await ProductStock.find(filter)
      .select(LIST_FIELDS)
      .populate("warehouse", "name code warehouseType status")
      .populate("location", "name code locationType status isQuarantine")
      .sort({ warehouse: 1, location: 1 })
      .limit(1000)
      .maxTimeMS(5000)
      .lean();

    const totals = stocks.reduce(
      (result, stock) => {
        result.onHandQuantity += Number(stock.onHandQuantity || 0);
        result.reservedQuantity += Number(stock.reservedQuantity || 0);
        result.quarantineQuantity += Number(stock.quarantineQuantity || 0);
        result.availableQuantity += Number(stock.availableQuantity || 0);
        result.incomingQuantity += Number(stock.incomingQuantity || 0);
        result.outgoingQuantity += Number(stock.outgoingQuantity || 0);
        result.inventoryValue += Number(stock.inventoryValue || 0);
        return result;
      },
      {
        onHandQuantity: 0,
        reservedQuantity: 0,
        quarantineQuantity: 0,
        availableQuantity: 0,
        incomingQuantity: 0,
        outgoingQuantity: 0,
        inventoryValue: 0,
      }
    );

    for (const field of Object.keys(totals)) {
      totals[field] = field === "inventoryValue" ? roundMoney(totals[field]) : roundQuantity(totals[field]);
    }

    return res.json({ count: stocks.length, totals, stocks });
  } catch (error) {
    return res.status(500).json({ message: "Failed to load product availability.", error: error.message });
  }
};

export const getStockPosition = async (req, res) => {
  try {
    const product = clean(req.query.product);
    const warehouse = clean(req.query.warehouse);
    const location = nullableId(req.query.location);

    if (!isId(product) || !isId(warehouse) || location === undefined) {
      return res.status(400).json({ message: "Valid product, warehouse and optional location are required." });
    }

    const stock = await ProductStock.findOne({ product, warehouse, location: location || null })
      .select(LIST_FIELDS)
      .populate("product", "name sku barcode imageUrl status")
      .populate("warehouse", "name code status")
      .populate("location", "name code locationType status")
      .maxTimeMS(3000)
      .lean();

    if (!stock) return res.status(404).json({ message: "Stock position was not initialized." });
    return res.json({ stock });
  } catch (error) {
    return res.status(500).json({ message: "Failed to load stock position.", error: error.message });
  }
};

export const getProductStock = async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(400).json({ message: "Invalid stock ID." });

    const stock = await ProductStock.findById(req.params.id)
      .select(LIST_FIELDS)
      .populate("product", "name sku barcode imageUrl productType trackInventory baseUnit status")
      .populate("warehouse", "name code warehouseType branch status allowNegativeStock")
      .populate("location", "name code locationType parent status isQuarantine")
      .populate("createdBy", "name email")
      .populate("updatedBy", "name email")
      .maxTimeMS(3000)
      .lean();

    if (!stock) return res.status(404).json({ message: "Product stock record not found." });
    return res.json({ stock });
  } catch (error) {
    return res.status(500).json({ message: "Failed to load product stock record.", error: error.message });
  }
};

export const initializeProductStock = async (req, res) => {
  try {
    const productId = clean(req.body.product);
    const warehouseId = clean(req.body.warehouse);
    const locationId = nullableId(req.body.location);
    if (locationId === undefined) {
      return res.status(400).json({ message: "Location must be a valid ID or empty." });
    }

    const { product } = await validateStockReferences({
      productId,
      warehouseId,
      locationId,
      requireActive: true,
    });

    const settings = buildStockSettingsPayload(req.body, req.user?._id || null);
    const initialState = {
      reorderLevel: settings.reorderLevel ?? Number(product.reorderLevel || 0),
      minimumStock: settings.minimumStock ?? Number(product.minimumStock || 0),
      maximumStock: settings.maximumStock ?? Number(product.maximumStock || 0),
    };
    const errors = validateSettingsPayload(initialState);
    if (errors.length) return res.status(400).json({ message: errors[0], errors });

    const key = { product: productId, warehouse: warehouseId, location: locationId || null };
    const existing = await ProductStock.findOne(key).select("status").lean();
    if (existing) {
      if (existing.status === "archived") {
        return res.status(409).json({ message: "This stock position is archived. Restore it instead of creating another record." });
      }
      const stock = await ProductStock.findById(existing._id)
        .select(LIST_FIELDS)
        .populate("product", "name sku barcode imageUrl status")
        .populate("warehouse", "name code status")
        .populate("location", "name code locationType status")
        .lean();
      return res.json({ message: "Stock position already exists.", stock });
    }

    const stock = await ProductStock.create({
      ...key,
      ...initialState,
      onHandQuantity: 0,
      reservedQuantity: 0,
      quarantineQuantity: 0,
      availableQuantity: 0,
      incomingQuantity: 0,
      outgoingQuantity: 0,
      averageCost: roundMoney(product.purchasePrice || 0),
      inventoryValue: 0,
      status: "active",
      createdBy: req.user?._id || null,
      updatedBy: req.user?._id || null,
    });

    const populated = await stock.populate([
      { path: "product", select: "name sku barcode imageUrl status" },
      { path: "warehouse", select: "name code status" },
      { path: "location", select: "name code locationType status" },
    ]);

    return res.status(201).json({ message: "Stock position initialized with zero quantity.", stock: populated });
  } catch (error) {
    if (error?.code === 11000) {
      const stock = await ProductStock.findOne({
        product: req.body.product,
        warehouse: req.body.warehouse,
        location: clean(req.body.location) || null,
      })
        .select(LIST_FIELDS)
        .lean();
      return res.status(200).json({ message: "Stock position already exists.", stock });
    }
    return sendWriteError(res, error, "Failed to initialize product stock.");
  }
};

export const createOpeningStock = async (req, res) => {
  try {
    const command = buildOpeningStockCommand(req.body);
    await validateStockReferences({
      productId: command.product,
      warehouseId: command.warehouse,
      locationId: command.location,
      requireActive: true,
    });

    const result = await runMongoTransaction(async (session) => {
      const key = {
        product: command.product,
        warehouse: command.warehouse,
        location: command.location || null,
      };
      const existingStock = await withSession(ProductStock.findOne(key), session);
      if (existingStock?.status === "archived") {
        throw Object.assign(
          new Error("This stock position is archived. Restore it before adding quantity."),
          { statusCode: 409 }
        );
      }
      if (existingStock?.status === "inactive") {
        existingStock.status = "active";
        existingStock.updatedBy = req.user?._id || null;
        await existingStock.save(sessionOptions(session));
      }

      let movement = command.idempotencyKey
        ? await withSession(StockMovement.findOne({ idempotencyKey: command.idempotencyKey }), session)
        : null;

      if (!movement) {
        movement = new StockMovement(
          buildOpeningStockMovement(command, req.user?._id || null)
        );
        await movement.save(sessionOptions(session));
      }

      movement = await StockMovement.postMovementDocument({
        movementId: movement._id,
        userId: req.user?._id || null,
        session,
      });

      const stock = await withSession(ProductStock.findOne(key), session);
      return { movement, stock };
    });

    await Promise.all([
      result.stock?.populate([
        { path: "product", select: "name sku barcode imageUrl status" },
        { path: "warehouse", select: "name code status" },
        { path: "location", select: "name code locationType status" },
      ]),
      result.movement?.populate("createdBy", "name email"),
    ]);

    return res.status(201).json({
      message: "Opening stock posted successfully.",
      stock: result.stock,
      movement: result.movement,
    });
  } catch (error) {
    return sendWriteError(res, error, "Failed to post opening stock.");
  }
};

export const updateProductStockSettings = async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(400).json({ message: "Invalid stock ID." });

    const payload = buildStockSettingsPayload(req.body, req.user?._id || null);
    const editableKeys = Object.keys(payload).filter((key) => key !== "updatedBy");
    if (!editableKeys.length) return res.status(400).json({ message: "No valid stock settings were provided." });

    const current = await ProductStock.findById(req.params.id)
      .select("product warehouse location reorderLevel minimumStock maximumStock status onHandQuantity reservedQuantity quarantineQuantity incomingQuantity outgoingQuantity")
      .lean();
    if (!current) return res.status(404).json({ message: "Product stock record not found." });
    if (current.status === "archived") {
      return res.status(409).json({ message: "Restore the archived stock record before editing it." });
    }

    const errors = validateSettingsPayload(payload, current);
    if (errors.length) return res.status(400).json({ message: errors[0], errors });

    if (payload.status === "inactive" && hasAnyQuantity(current)) {
      return res.status(409).json({ message: "A stock record with balances or pending quantities cannot be deactivated." });
    }
    if (payload.status === "active") {
      await validateStockReferences({
        productId: current.product,
        warehouseId: current.warehouse,
        locationId: current.location,
        requireActive: true,
      });
    }

    const stock = await ProductStock.findByIdAndUpdate(req.params.id, payload, {
      new: true,
      runValidators: true,
      context: "query",
    })
      .select(LIST_FIELDS)
      .populate("product", "name sku barcode imageUrl status")
      .populate("warehouse", "name code status")
      .populate("location", "name code locationType status");

    return res.json({ message: "Product stock settings updated.", stock });
  } catch (error) {
    return sendWriteError(res, error, "Failed to update product stock settings.");
  }
};

export const deleteProductStock = async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(400).json({ message: "Invalid stock ID." });

    const current = await ProductStock.findById(req.params.id)
      .select("status onHandQuantity reservedQuantity quarantineQuantity incomingQuantity outgoingQuantity")
      .lean();
    if (!current) return res.status(404).json({ message: "Product stock record not found." });
    if (current.status === "archived") return res.status(404).json({ message: "Product stock record is already archived." });
    if (hasAnyQuantity(current)) {
      return res.status(409).json({ message: "A stock record with balances or pending quantities cannot be archived." });
    }

    const stock = await ProductStock.findByIdAndUpdate(
      req.params.id,
      { status: "archived", archivedAt: new Date(), updatedBy: req.user?._id || null },
      { new: true, runValidators: true }
    ).select("product warehouse location status archivedAt");

    return res.json({ message: "Zero-balance product stock record archived.", stock });
  } catch (error) {
    return sendWriteError(res, error, "Failed to archive product stock record.");
  }
};

export const restoreProductStock = async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(400).json({ message: "Invalid stock ID." });

    const current = await ProductStock.findOne({ _id: req.params.id, status: "archived" })
      .select("product warehouse location")
      .lean();
    if (!current) return res.status(404).json({ message: "Archived product stock record not found." });

    await validateStockReferences({
      productId: current.product,
      warehouseId: current.warehouse,
      locationId: current.location,
      requireActive: false,
    });

    const stock = await ProductStock.findByIdAndUpdate(
      req.params.id,
      { status: "inactive", archivedAt: null, updatedBy: req.user?._id || null },
      { new: true, runValidators: true }
    )
      .select(LIST_FIELDS)
      .populate("product", "name sku barcode imageUrl status")
      .populate("warehouse", "name code status")
      .populate("location", "name code locationType status");

    return res.json({ message: "Product stock record restored as inactive.", stock });
  } catch (error) {
    return sendWriteError(res, error, "Failed to restore product stock record.");
  }
};
