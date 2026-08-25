import mongoose from "mongoose";
import Product from "../../models/inventory/product.model.js";
import ProductStock from "../../models/inventory/productStock.model.js";
import StockMovement from "../../models/inventory/stockMovement.model.js";
import StockTransfer from "../../models/inventory/stockTransfer.model.js";
import Warehouse from "../../models/inventory/warehouse.model.js";

const clean = (value) => String(value ?? "").trim();
const isId = (value) => mongoose.Types.ObjectId.isValid(String(value || ""));
const oid = (value) => new mongoose.Types.ObjectId(String(value));
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const parseLimit = (value, fallback = 30, max = 200) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.trunc(parsed), 1), max);
};

const parseBoolean = (value) => {
  if (value === true || value === "true") return true;
  if (value === false || value === "false") return false;
  return undefined;
};

const parseDate = (value, fallback = null) => {
  if (!value) return fallback;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const parseDateRange = (query = {}, { defaultDays = 30, maxDays = 366 } = {}) => {
  const now = new Date();
  const to = parseDate(query.to, now);
  const defaultFrom = new Date(to.getTime() - defaultDays * 24 * 60 * 60 * 1000);
  const from = parseDate(query.from, defaultFrom);
  if (!from || !to) {
    throw Object.assign(new Error("Enter a valid report date range."), { statusCode: 400 });
  }
  if (from > to) {
    throw Object.assign(new Error("The report start date cannot be after the end date."), { statusCode: 400 });
  }
  const days = (to.getTime() - from.getTime()) / 86400000;
  if (days > maxDays) {
    throw Object.assign(new Error(`The maximum report range is ${maxDays} days.`), { statusCode: 400 });
  }
  return { from, to };
};

const sendError = (res, error, fallback) =>
  res.status(error?.statusCode || 500).json({
    message: error?.statusCode ? error.message : fallback,
    error: error.message,
  });

const encodeIdCursor = (document) =>
  Buffer.from(JSON.stringify({ id: String(document._id) }), "utf8").toString("base64url");

const decodeIdCursor = (value) => {
  try {
    if (!value) return null;
    const parsed = JSON.parse(Buffer.from(String(value), "base64url").toString("utf8"));
    return isId(parsed?.id) ? oid(parsed.id) : null;
  } catch {
    return null;
  }
};

const encodeDateCursor = (document, dateField = "movementDate") =>
  Buffer.from(
    JSON.stringify({ d: new Date(document[dateField]).toISOString(), id: String(document._id) }),
    "utf8"
  ).toString("base64url");

const decodeDateCursor = (value) => {
  try {
    if (!value) return null;
    const parsed = JSON.parse(Buffer.from(String(value), "base64url").toString("utf8"));
    const date = new Date(parsed?.d);
    if (Number.isNaN(date.getTime()) || !isId(parsed?.id)) return null;
    return { date, id: oid(parsed.id) };
  } catch {
    return null;
  }
};

const encodeLedgerCursor = (row) =>
  Buffer.from(
    JSON.stringify({
      d: new Date(row.movementDate).toISOString(),
      m: String(row._id),
      l: String(row.lines._id),
    }),
    "utf8"
  ).toString("base64url");

const decodeLedgerCursor = (value) => {
  try {
    if (!value) return null;
    const parsed = JSON.parse(Buffer.from(String(value), "base64url").toString("utf8"));
    const date = new Date(parsed?.d);
    if (Number.isNaN(date.getTime()) || !isId(parsed?.m) || !isId(parsed?.l)) return null;
    return { date, movementId: oid(parsed.m), lineId: oid(parsed.l) };
  } catch {
    return null;
  }
};

const resolveProductIds = async (query = {}) => {
  const q = clean(query.q);
  const filter = { status: { $ne: "archived" } };
  let required = false;

  if (isId(query.category)) {
    filter.category = query.category;
    required = true;
  }
  if (isId(query.brand)) {
    filter.brand = query.brand;
    required = true;
  }
  if (query.productType && query.productType !== "all") {
    filter.productType = clean(query.productType).toLowerCase();
    required = true;
  }
  if (q) {
    required = true;
    const namePrefix = new RegExp(`^${escapeRegex(q.toLowerCase())}`);
    const codePrefix = new RegExp(`^${escapeRegex(q.toUpperCase())}`);
    filter.$or = [{ nameLower: namePrefix }, { sku: codePrefix }, { barcode: codePrefix }];
  }

  if (!required) return null;
  const products = await Product.find(filter)
    .select("_id")
    .sort({ _id: 1 })
    .limit(10001)
    .maxTimeMS(5000)
    .lean();
  if (products.length > 10000) {
    throw Object.assign(new Error("The product filter is too broad. Add a more specific search or category."), {
      statusCode: 400,
    });
  }
  return products.map((product) => product._id);
};

const baseStockFilter = async (query = {}) => {
  const filter = { status: query.status && query.status !== "all" ? clean(query.status).toLowerCase() : "active" };
  if (isId(query.warehouse)) filter.warehouse = query.warehouse;
  if (isId(query.location)) filter.location = query.location;
  if (isId(query.product)) filter.product = query.product;

  const productIds = await resolveProductIds(query);
  if (productIds) {
    if (filter.product && !productIds.some((id) => String(id) === String(filter.product))) {
      filter.product = { $in: [] };
    } else if (!filter.product) {
      filter.product = { $in: productIds };
    }
  }

  const quantityState = clean(query.quantityState).toLowerCase();
  if (quantityState === "positive") filter.onHandQuantity = { $gt: 0 };
  if (quantityState === "zero") filter.onHandQuantity = 0;
  if (quantityState === "negative") filter.onHandQuantity = { $lt: 0 };
  if (quantityState === "available") filter.availableQuantity = { $gt: 0 };
  return filter;
};

export const getInventoryDashboard = async (req, res) => {
  try {
    const warehouseFilter = isId(req.query.warehouse) ? { warehouse: oid(req.query.warehouse) } : {};
    const stockMatch = { status: "active", ...warehouseFilter };
    const movementFrom = new Date(Date.now() - 30 * 86400000);
    const movementMatch = {
      status: "posted",
      movementDate: { $gte: movementFrom },
      ...(isId(req.query.warehouse)
        ? {
            $or: [
              { sourceWarehouses: oid(req.query.warehouse) },
              { destinationWarehouses: oid(req.query.warehouse) },
            ],
          }
        : {}),
    };

    const [stockSummaryRows, productCount, warehouseCount, lowStockRows, movementEffects, transferCounts, recentMovements] =
      await Promise.all([
        ProductStock.aggregate([
          { $match: stockMatch },
          {
            $group: {
              _id: null,
              stockPositions: { $sum: 1 },
              onHandQuantity: { $sum: "$onHandQuantity" },
              availableQuantity: { $sum: "$availableQuantity" },
              reservedQuantity: { $sum: "$reservedQuantity" },
              quarantineQuantity: { $sum: "$quarantineQuantity" },
              incomingQuantity: { $sum: "$incomingQuantity" },
              outgoingQuantity: { $sum: "$outgoingQuantity" },
              inventoryValue: { $sum: "$inventoryValue" },
              negativePositions: { $sum: { $cond: [{ $lt: ["$availableQuantity", 0] }, 1, 0] } },
              zeroPositions: { $sum: { $cond: [{ $eq: ["$availableQuantity", 0] }, 1, 0] } },
            },
          },
          { $project: { _id: 0 } },
        ]).option({ maxTimeMS: 5000 }),
        Product.countDocuments({ status: "active", productType: "inventory", trackInventory: true }).maxTimeMS(5000),
        Warehouse.countDocuments({ status: "active" }).maxTimeMS(5000),
        ProductStock.aggregate([
          { $match: stockMatch },
          {
            $lookup: {
              from: "products",
              localField: "product",
              foreignField: "_id",
              as: "product",
              pipeline: [{ $project: { reorderLevel: 1, status: 1 } }],
            },
          },
          { $unwind: "$product" },
          { $match: { "product.status": "active" } },
          {
            $set: {
              effectiveReorderLevel: {
                $cond: [{ $gt: ["$reorderLevel", 0] }, "$reorderLevel", { $ifNull: ["$product.reorderLevel", 0] }],
              },
            },
          },
          { $match: { effectiveReorderLevel: { $gt: 0 }, $expr: { $lte: ["$availableQuantity", "$effectiveReorderLevel"] } } },
          { $count: "count" },
        ]).option({ maxTimeMS: 5000 }),
        StockMovement.aggregate([
          { $match: movementMatch },
          { $unwind: "$lines" },
          {
            $group: {
              _id: "$lines.effect",
              quantity: { $sum: "$lines.quantity" },
              value: { $sum: "$lines.appliedValue" },
              lineCount: { $sum: 1 },
            },
          },
          { $sort: { _id: 1 } },
        ]).option({ maxTimeMS: 5000 }),
        StockTransfer.aggregate([
          {
            $match: {
              ...(isId(req.query.warehouse)
                ? {
                    $or: [
                      { sourceWarehouse: oid(req.query.warehouse) },
                      { destinationWarehouse: oid(req.query.warehouse) },
                    ],
                  }
                : {}),
            },
          },
          {
            $group: {
              _id: null,
              awaitingApproval: { $sum: { $cond: [{ $eq: ["$status", "submitted"] }, 1, 0] } },
              approved: { $sum: { $cond: [{ $eq: ["$status", "approved"] }, 1, 0] } },
              inTransit: {
                $sum: { $cond: [{ $in: ["$status", ["dispatched", "partially_received"]] }, 1, 0] },
              },
            },
          },
          { $project: { _id: 0 } },
        ]).option({ maxTimeMS: 5000 }),
        StockMovement.find(movementMatch)
          .select("movementNo movementDate movementType reference totalQuantity totalValue sourceWarehouses destinationWarehouses")
          .populate("sourceWarehouses", "name code")
          .populate("destinationWarehouses", "name code")
          .sort({ movementDate: -1, _id: -1 })
          .limit(10)
          .maxTimeMS(5000)
          .lean(),
      ]);

    return res.json({
      generatedAt: new Date(),
      period: { from: movementFrom, to: new Date() },
      stock: stockSummaryRows[0] || {
        stockPositions: 0,
        onHandQuantity: 0,
        availableQuantity: 0,
        reservedQuantity: 0,
        quarantineQuantity: 0,
        incomingQuantity: 0,
        outgoingQuantity: 0,
        inventoryValue: 0,
        negativePositions: 0,
        zeroPositions: 0,
      },
      activeProducts: productCount,
      activeWarehouses: warehouseCount,
      lowStockPositions: lowStockRows[0]?.count || 0,
      movementEffects,
      transfers: transferCounts[0] || { awaitingApproval: 0, approved: 0, inTransit: 0 },
      recentMovements,
    });
  } catch (error) {
    return sendError(res, error, "Failed to load the inventory dashboard.");
  }
};

export const getCurrentStockReport = async (req, res) => {
  try {
    const limit = parseLimit(req.query.limit, 50, 200);
    const cursor = decodeIdCursor(req.query.cursor);
    if (req.query.cursor && !cursor) return res.status(400).json({ message: "Invalid pagination cursor." });

    const filter = await baseStockFilter(req.query);
    if (cursor) filter._id = { $gt: cursor };

    const stocks = await ProductStock.find(filter)
      .select(
        "product warehouse location onHandQuantity reservedQuantity quarantineQuantity availableQuantity incomingQuantity outgoingQuantity averageCost inventoryValue reorderLevel minimumStock maximumStock lastMovementAt lastCountedAt stockVersion status"
      )
      .populate("product", "name sku barcode imageUrl category brand baseUnit currency status")
      .populate("warehouse", "name code warehouseType status")
      .populate("location", "name code locationType status")
      .sort({ _id: 1 })
      .limit(limit + 1)
      .maxTimeMS(5000)
      .lean();

    const hasMore = stocks.length > limit;
    if (hasMore) stocks.pop();
    const nextCursor = hasMore && stocks.length ? encodeIdCursor(stocks[stocks.length - 1]) : null;
    return res.json({ count: stocks.length, hasMore, nextCursor, stocks });
  } catch (error) {
    return sendError(res, error, "Failed to load the current stock report.");
  }
};

export const getStockValuationReport = async (req, res) => {
  try {
    const groupBy = ["warehouse", "product", "location"].includes(req.query.groupBy)
      ? req.query.groupBy
      : "warehouse";
    const limit = parseLimit(req.query.limit, 100, 500);
    const match = { status: "active" };
    if (isId(req.query.warehouse)) match.warehouse = oid(req.query.warehouse);
    if (isId(req.query.location)) match.location = oid(req.query.location);
    if (isId(req.query.product)) match.product = oid(req.query.product);
    const productIds = await resolveProductIds(req.query);
    if (productIds) {
      if (match.product && !productIds.some((id) => String(id) === String(match.product))) {
        match.product = { $in: [] };
      } else if (!match.product) {
        match.product = { $in: productIds };
      }
    }

    const result = await ProductStock.aggregate([
      { $match: match },
      {
        $facet: {
          summary: [
            {
              $group: {
                _id: null,
                stockPositions: { $sum: 1 },
                onHandQuantity: { $sum: "$onHandQuantity" },
                availableQuantity: { $sum: "$availableQuantity" },
                inventoryValue: { $sum: "$inventoryValue" },
              },
            },
            { $project: { _id: 0 } },
          ],
          rows: [
            {
              $group: {
                _id: `$${groupBy}`,
                stockPositions: { $sum: 1 },
                onHandQuantity: { $sum: "$onHandQuantity" },
                availableQuantity: { $sum: "$availableQuantity" },
                reservedQuantity: { $sum: "$reservedQuantity" },
                quarantineQuantity: { $sum: "$quarantineQuantity" },
                inventoryValue: { $sum: "$inventoryValue" },
              },
            },
            { $sort: { inventoryValue: -1, _id: 1 } },
            { $limit: limit },
            ...(groupBy === "warehouse"
              ? [
                  { $lookup: { from: "warehouses", localField: "_id", foreignField: "_id", as: "entity" } },
                  { $set: { entity: { $arrayElemAt: ["$entity", 0] } } },
                  { $project: { "entity.nameLower": 0, "entity.address": 0 } },
                ]
              : groupBy === "product"
              ? [
                  { $lookup: { from: "products", localField: "_id", foreignField: "_id", as: "entity" } },
                  { $set: { entity: { $arrayElemAt: ["$entity", 0] } } },
                  { $project: { "entity.nameLower": 0, "entity.description": 0 } },
                ]
              : [
                  {
                    $lookup: {
                      from: "warehouselocations",
                      localField: "_id",
                      foreignField: "_id",
                      as: "entity",
                    },
                  },
                  { $set: { entity: { $arrayElemAt: ["$entity", 0] } } },
                  { $project: { "entity.nameLower": 0, "entity.ancestors": 0 } },
                ]),
          ],
        },
      },
    ]).option({ maxTimeMS: 8000 });

    return res.json({
      groupBy,
      summary: result[0]?.summary?.[0] || {
        stockPositions: 0,
        onHandQuantity: 0,
        availableQuantity: 0,
        inventoryValue: 0,
      },
      rows: result[0]?.rows || [],
    });
  } catch (error) {
    return sendError(res, error, "Failed to load the stock valuation report.");
  }
};

export const getLowStockReport = async (req, res) => {
  try {
    const limit = parseLimit(req.query.limit, 50, 200);
    const cursor = decodeIdCursor(req.query.cursor);
    if (req.query.cursor && !cursor) return res.status(400).json({ message: "Invalid pagination cursor." });

    const match = { status: "active" };
    if (isId(req.query.warehouse)) match.warehouse = oid(req.query.warehouse);
    if (isId(req.query.location)) match.location = oid(req.query.location);
    if (isId(req.query.product)) match.product = oid(req.query.product);
    const productIds = await resolveProductIds(req.query);
    if (productIds) {
      if (match.product && !productIds.some((id) => String(id) === String(match.product))) {
        match.product = { $in: [] };
      } else if (!match.product) {
        match.product = { $in: productIds };
      }
    }
    if (cursor) match._id = { $gt: cursor };
    const includeOutOfStock = parseBoolean(req.query.includeOutOfStock) !== false;

    const rows = await ProductStock.aggregate([
      { $match: match },
      {
        $lookup: {
          from: "products",
          localField: "product",
          foreignField: "_id",
          as: "product",
          pipeline: [
            { $match: { status: "active", productType: "inventory", trackInventory: true } },
            { $project: { name: 1, sku: 1, barcode: 1, imageUrl: 1, reorderLevel: 1, minimumStock: 1, maximumStock: 1, generalOrderQuantity: 1, category: 1, brand: 1, baseUnit: 1 } },
          ],
        },
      },
      { $unwind: "$product" },
      {
        $set: {
          effectiveReorderLevel: {
            $cond: [{ $gt: ["$reorderLevel", 0] }, "$reorderLevel", { $ifNull: ["$product.reorderLevel", 0] }],
          },
        },
      },
      {
        $match: {
          effectiveReorderLevel: { $gt: 0 },
          $expr: {
            $and: [
              { $lte: ["$availableQuantity", "$effectiveReorderLevel"] },
              ...(includeOutOfStock ? [] : [{ $gt: ["$availableQuantity", 0] }]),
            ],
          },
        },
      },
      { $sort: { _id: 1 } },
      { $limit: limit + 1 },
      { $lookup: { from: "warehouses", localField: "warehouse", foreignField: "_id", as: "warehouse" } },
      { $set: { warehouse: { $arrayElemAt: ["$warehouse", 0] } } },
      {
        $lookup: {
          from: "warehouselocations",
          localField: "location",
          foreignField: "_id",
          as: "location",
        },
      },
      { $set: { location: { $arrayElemAt: ["$location", 0] } } },
      {
        $project: {
          product: 1,
          warehouse: { _id: "$warehouse._id", name: "$warehouse.name", code: "$warehouse.code" },
          location: {
            _id: "$location._id",
            name: "$location.name",
            code: "$location.code",
            locationType: "$location.locationType",
          },
          onHandQuantity: 1,
          availableQuantity: 1,
          reservedQuantity: 1,
          quarantineQuantity: 1,
          incomingQuantity: 1,
          effectiveReorderLevel: 1,
          shortageQuantity: {
            $max: [{ $subtract: ["$effectiveReorderLevel", "$availableQuantity"] }, 0],
          },
          suggestedPurchaseQuantity: {
            $let: {
              vars: {
                shortage: { $max: [{ $subtract: ["$effectiveReorderLevel", "$availableQuantity"] }, 0] },
                orderQuantity: { $ifNull: ["$product.generalOrderQuantity", 0] },
              },
              in: {
                $cond: [
                  { $gt: ["$$orderQuantity", 0] },
                  { $multiply: [{ $ceil: { $divide: ["$$shortage", "$$orderQuantity"] } }, "$$orderQuantity"] },
                  "$$shortage",
                ],
              },
            },
          },
          inventoryValue: 1,
          lastMovementAt: 1,
        },
      },
    ]).option({ maxTimeMS: 8000 });

    const hasMore = rows.length > limit;
    if (hasMore) rows.pop();
    const nextCursor = hasMore && rows.length ? encodeIdCursor(rows[rows.length - 1]) : null;
    return res.json({ count: rows.length, hasMore, nextCursor, rows });
  } catch (error) {
    return sendError(res, error, "Failed to load the low-stock report.");
  }
};

export const getWarehouseStockSummary = async (req, res) => {
  try {
    const match = { status: "active" };
    if (isId(req.query.warehouse)) match.warehouse = oid(req.query.warehouse);
    if (isId(req.query.product)) match.product = oid(req.query.product);
    const productIds = await resolveProductIds(req.query);
    if (productIds) {
      if (match.product && !productIds.some((id) => String(id) === String(match.product))) {
        match.product = { $in: [] };
      } else if (!match.product) {
        match.product = { $in: productIds };
      }
    }
    const rows = await ProductStock.aggregate([
      { $match: match },
      {
        $group: {
          _id: { warehouse: "$warehouse", product: "$product" },
          stockPositions: { $sum: 1 },
          onHandQuantity: { $sum: "$onHandQuantity" },
          availableQuantity: { $sum: "$availableQuantity" },
          reservedQuantity: { $sum: "$reservedQuantity" },
          quarantineQuantity: { $sum: "$quarantineQuantity" },
          incomingQuantity: { $sum: "$incomingQuantity" },
          outgoingQuantity: { $sum: "$outgoingQuantity" },
          inventoryValue: { $sum: "$inventoryValue" },
        },
      },
      {
        $group: {
          _id: "$_id.warehouse",
          productCount: { $sum: 1 },
          stockPositions: { $sum: "$stockPositions" },
          onHandQuantity: { $sum: "$onHandQuantity" },
          availableQuantity: { $sum: "$availableQuantity" },
          reservedQuantity: { $sum: "$reservedQuantity" },
          quarantineQuantity: { $sum: "$quarantineQuantity" },
          incomingQuantity: { $sum: "$incomingQuantity" },
          outgoingQuantity: { $sum: "$outgoingQuantity" },
          inventoryValue: { $sum: "$inventoryValue" },
        },
      },
      { $lookup: { from: "warehouses", localField: "_id", foreignField: "_id", as: "warehouse" } },
      { $set: { warehouse: { $arrayElemAt: ["$warehouse", 0] } } },
      { $match: { "warehouse.status": { $ne: "archived" } } },
      { $sort: { inventoryValue: -1, _id: 1 } },
      {
        $project: {
          warehouse: {
            _id: "$warehouse._id",
            name: "$warehouse.name",
            code: "$warehouse.code",
            warehouseType: "$warehouse.warehouseType",
            status: "$warehouse.status",
          },
          productCount: 1,
          stockPositions: 1,
          onHandQuantity: 1,
          availableQuantity: 1,
          reservedQuantity: 1,
          quarantineQuantity: 1,
          incomingQuantity: 1,
          outgoingQuantity: 1,
          inventoryValue: 1,
        },
      },
    ]).option({ maxTimeMS: 8000 });

    return res.json({ count: rows.length, rows });
  } catch (error) {
    return sendError(res, error, "Failed to load the warehouse stock summary.");
  }
};

export const getStockMovementReport = async (req, res) => {
  try {
    const { from, to } = parseDateRange(req.query, { defaultDays: 30, maxDays: 366 });
    const limit = parseLimit(req.query.limit, 30, 100);
    const cursor = decodeDateCursor(req.query.cursor);
    if (req.query.cursor && !cursor) return res.status(400).json({ message: "Invalid pagination cursor." });

    const filter = { status: "posted", movementDate: { $gte: from, $lte: to } };
    if (req.query.movementType && req.query.movementType !== "all") {
      filter.movementType = clean(req.query.movementType).toLowerCase();
    }
    if (isId(req.query.product)) filter.products = req.query.product;
    if (isId(req.query.warehouse)) {
      filter.$or = [
        { sourceWarehouses: req.query.warehouse },
        { destinationWarehouses: req.query.warehouse },
      ];
    }
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

    const summaryMatch = { status: "posted", movementDate: { $gte: from, $lte: to } };
    if (req.query.movementType && req.query.movementType !== "all") {
      summaryMatch.movementType = clean(req.query.movementType).toLowerCase();
    }
    if (isId(req.query.product)) summaryMatch.products = oid(req.query.product);
    if (isId(req.query.warehouse)) {
      summaryMatch.$or = [
        { sourceWarehouses: oid(req.query.warehouse) },
        { destinationWarehouses: oid(req.query.warehouse) },
      ];
    }

    const lineMatch = {};
    if (isId(req.query.product)) lineMatch["lines.product"] = oid(req.query.product);
    if (isId(req.query.warehouse)) {
      lineMatch.$or = [
        { "lines.sourceWarehouse": oid(req.query.warehouse) },
        { "lines.destinationWarehouse": oid(req.query.warehouse) },
      ];
    }

    const [movements, effectRows] = await Promise.all([
      StockMovement.find(filter)
        .select(
          "movementNo movementDate movementType reference sourceType sourceId currency reason products sourceWarehouses destinationWarehouses lineCount totalQuantity totalValue postedAt postedBy"
        )
        .populate("products", "name sku barcode imageUrl status")
        .populate("sourceWarehouses", "name code status")
        .populate("destinationWarehouses", "name code status")
        .sort({ movementDate: -1, _id: -1 })
        .limit(limit + 1)
        .maxTimeMS(5000)
        .lean(),
      StockMovement.aggregate([
        { $match: summaryMatch },
        { $unwind: "$lines" },
        ...(Object.keys(lineMatch).length ? [{ $match: lineMatch }] : []),
        {
          $group: {
            _id: "$lines.effect",
            quantity: { $sum: "$lines.quantity" },
            appliedValue: { $sum: "$lines.appliedValue" },
            lineCount: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]).option({ maxTimeMS: 8000 }),
    ]);

    const hasMore = movements.length > limit;
    if (hasMore) movements.pop();
    const nextCursor = hasMore && movements.length ? encodeDateCursor(movements[movements.length - 1]) : null;
    return res.json({
      period: { from, to },
      effects: effectRows,
      count: movements.length,
      hasMore,
      nextCursor,
      movements,
    });
  } catch (error) {
    return sendError(res, error, "Failed to load the stock movement report.");
  }
};

export const getProductStockLedger = async (req, res) => {
  try {
    if (!isId(req.params.productId)) return res.status(400).json({ message: "Invalid product ID." });
    const { from, to } = parseDateRange(req.query, { defaultDays: 90, maxDays: 732 });
    const limit = parseLimit(req.query.limit, 50, 200);
    const cursor = decodeLedgerCursor(req.query.cursor);
    if (req.query.cursor && !cursor) return res.status(400).json({ message: "Invalid ledger cursor." });

    const initialMatch = {
      status: "posted",
      movementDate: { $gte: from, $lte: to },
      products: oid(req.params.productId),
    };
    const lineMatch = { "lines.product": oid(req.params.productId) };
    if (isId(req.query.warehouse)) {
      lineMatch.$or = [
        { "lines.sourceWarehouse": oid(req.query.warehouse) },
        { "lines.destinationWarehouse": oid(req.query.warehouse) },
      ];
    }
    if (isId(req.query.location)) {
      lineMatch.$and = [
        ...(lineMatch.$and || []),
        {
          $or: [
            { "lines.sourceLocation": oid(req.query.location) },
            { "lines.destinationLocation": oid(req.query.location) },
          ],
        },
      ];
    }

    const cursorMatch = cursor
      ? {
          $or: [
            { movementDate: { $lt: cursor.date } },
            { movementDate: cursor.date, _id: { $lt: cursor.movementId } },
            {
              movementDate: cursor.date,
              _id: cursor.movementId,
              "lines._id": { $lt: cursor.lineId },
            },
          ],
        }
      : null;

    const rows = await StockMovement.aggregate([
      { $match: initialMatch },
      { $unwind: "$lines" },
      { $match: lineMatch },
      ...(cursorMatch ? [{ $match: cursorMatch }] : []),
      { $sort: { movementDate: -1, _id: -1, "lines._id": -1 } },
      { $limit: limit + 1 },
      {
        $lookup: {
          from: "warehouses",
          localField: "lines.sourceWarehouse",
          foreignField: "_id",
          as: "sourceWarehouseData",
        },
      },
      {
        $lookup: {
          from: "warehouses",
          localField: "lines.destinationWarehouse",
          foreignField: "_id",
          as: "destinationWarehouseData",
        },
      },
      {
        $lookup: {
          from: "warehouselocations",
          localField: "lines.sourceLocation",
          foreignField: "_id",
          as: "sourceLocationData",
        },
      },
      {
        $lookup: {
          from: "warehouselocations",
          localField: "lines.destinationLocation",
          foreignField: "_id",
          as: "destinationLocationData",
        },
      },
      {
        $project: {
          movementNo: 1,
          movementDate: 1,
          movementType: 1,
          reference: 1,
          sourceType: 1,
          sourceId: 1,
          currency: 1,
          reason: 1,
          postedAt: 1,
          lines: 1,
          sourceWarehouse: { $arrayElemAt: ["$sourceWarehouseData", 0] },
          destinationWarehouse: { $arrayElemAt: ["$destinationWarehouseData", 0] },
          sourceLocation: { $arrayElemAt: ["$sourceLocationData", 0] },
          destinationLocation: { $arrayElemAt: ["$destinationLocationData", 0] },
        },
      },
      {
        $project: {
          movementNo: 1,
          movementDate: 1,
          movementType: 1,
          reference: 1,
          sourceType: 1,
          sourceId: 1,
          currency: 1,
          reason: 1,
          postedAt: 1,
          line: "$lines",
          sourceWarehouse: {
            _id: "$sourceWarehouse._id",
            name: "$sourceWarehouse.name",
            code: "$sourceWarehouse.code",
          },
          destinationWarehouse: {
            _id: "$destinationWarehouse._id",
            name: "$destinationWarehouse.name",
            code: "$destinationWarehouse.code",
          },
          sourceLocation: {
            _id: "$sourceLocation._id",
            name: "$sourceLocation.name",
            code: "$sourceLocation.code",
            locationType: "$sourceLocation.locationType",
          },
          destinationLocation: {
            _id: "$destinationLocation._id",
            name: "$destinationLocation.name",
            code: "$destinationLocation.code",
            locationType: "$destinationLocation.locationType",
          },
        },
      },
    ]).option({ maxTimeMS: 10000 });

    const hasMore = rows.length > limit;
    if (hasMore) rows.pop();
    const nextCursor = hasMore && rows.length
      ? encodeLedgerCursor({ ...rows[rows.length - 1], lines: rows[rows.length - 1].line })
      : null;

    const product = await Product.findById(req.params.productId)
      .select("name sku barcode imageUrl baseUnit currency status")
      .lean();
    if (!product) return res.status(404).json({ message: "Product not found." });

    return res.json({
      product,
      period: { from, to },
      count: rows.length,
      hasMore,
      nextCursor,
      entries: rows,
    });
  } catch (error) {
    return sendError(res, error, "Failed to load the product stock ledger.");
  }
};
