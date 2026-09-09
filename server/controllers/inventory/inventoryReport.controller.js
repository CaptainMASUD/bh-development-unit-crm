import mongoose from "mongoose";
import Product from "../../models/inventory/product.model.js";
import ProductStock from "../../models/inventory/productStock.model.js";
import StockMovement from "../../models/inventory/stockMovement.model.js";
import StockTransfer from "../../models/inventory/stockTransfer.model.js";
import StockAdjustment from "../../models/inventory/stockAdjustment.model.js";
import Warehouse from "../../models/inventory/warehouse.model.js";
import WarehouseLocation from "../../models/inventory/warehouseLocation.model.js";
import InventoryValuation from "../../models/inventory/inventoryValuation.model.js";
import {
  InventoryLoss,
  InventoryTracking,
  WarehouseCheck,
} from "../../models/inventory/inventoryOperations.model.js";
import {
  calculateProductStockLedger,
  calculateValuationReport,
  reconcileInventoryWithGl,
  calculateStockAgingReport,
  calculateSlowMovingReport,
  runInventoryIntegrityDiagnostic,
  executeInventoryRepairPlan,
  parseLimit,
  parseDate,
  parseDateRange,
  encodeCursor,
  decodeCursor,
} from "../../services/inventoryReporting.service.js";
import { sendCsvStream } from "../../services/export.service.js";
import { inventoryDashboardCache } from "../../utils/cache.js";

const clean = (value) => String(value ?? "").trim();
const isId = (value) => mongoose.Types.ObjectId.isValid(String(value || ""));
const oid = (value) => new mongoose.Types.ObjectId(String(value));
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const num = (value) => Number(value || 0);
const roundQuantity = (value) => Math.round((num(value) + Number.EPSILON) * 1e6) / 1e6;
const roundMoney = (value) => Math.round((num(value) + Number.EPSILON) * 1e4) / 1e4;

const parseBoolean = (value) => {
  if (value === true || value === "true") return true;
  if (value === false || value === "false") return false;
  return undefined;
};

const sendError = (res, error, fallback) =>
  res.status(error?.statusCode || 500).json({
    message: error?.statusCode ? error.message : fallback,
    error: error.message,
  });

export const canViewCost = (user) => {
  if (!user) return false;
  if (user.role === "admin" || user.role === "superadmin") return true;
  return Array.isArray(user.permissions) && user.permissions.includes("inventory-report:cost-view");
};

const resolveProductIds = async (query = {}, tenantId = null) => {
  const q = clean(query.q);
  const filter = {
    status: { $ne: "archived" },
    ...(tenantId ? { tenantId } : {}),
  };
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

const baseStockFilter = async (query = {}, tenantId = null) => {
  const filter = {
    status: query.status && query.status !== "all" ? clean(query.status).toLowerCase() : "active",
    ...(tenantId ? { tenantId } : {}),
  };
  if (isId(query.warehouse)) filter.warehouse = query.warehouse;
  if (isId(query.location)) filter.location = query.location;
  if (isId(query.product)) filter.product = query.product;

  const productIds = await resolveProductIds(query, tenantId);
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

/**
 * 17. INVENTORY DASHBOARD DATA (with safe 15s tenant caching)
 */
export const getInventoryDashboard = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const warehouseId = isId(req.query.warehouse) ? String(req.query.warehouse) : "all";
    const cacheKey = `dashboard:${tenantId || "global"}:${warehouseId}`;

    const cached = inventoryDashboardCache.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const warehouseFilter = isId(req.query.warehouse) ? { warehouse: oid(req.query.warehouse) } : {};
    const stockMatch = {
      status: "active",
      ...(tenantId ? { tenantId: oid(tenantId) } : {}),
      ...warehouseFilter,
    };
    const movementFrom = new Date(Date.now() - 30 * 86400000);
    const movementMatch = {
      status: "posted",
      movementDate: { $gte: movementFrom },
      ...(tenantId ? { tenantId: oid(tenantId) } : {}),
      ...(isId(req.query.warehouse)
        ? {
            $or: [
              { sourceWarehouses: oid(req.query.warehouse) },
              { destinationWarehouses: oid(req.query.warehouse) },
            ],
          }
        : {}),
    };

    const [
      stockSummaryRows,
      productCount,
      warehouseCount,
      lowStockRows,
      movementEffects,
      transferCounts,
      recentMovements,
      valuationAgg,
    ] = await Promise.all([
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

      Product.countDocuments({
        status: "active",
        productType: "inventory",
        trackInventory: true,
        ...(tenantId ? { tenantId } : {}),
      }).maxTimeMS(5000),

      Warehouse.countDocuments({
        status: "active",
        ...(tenantId ? { tenantId } : {}),
      }).maxTimeMS(5000),

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
            ...(tenantId ? { tenantId: oid(tenantId) } : {}),
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

      InventoryValuation.aggregate([
        {
          $match: {
            ...(tenantId ? { tenantId: oid(tenantId) } : {}),
            ...(isId(req.query.warehouse) ? { warehouse: oid(req.query.warehouse) } : {}),
          },
        },
        {
          $group: {
            _id: null,
            totalValuationValue: { $sum: "$inventoryValue" },
          },
        },
      ]),
    ]);

    const totalValuation = valuationAgg[0]?.totalValuationValue || stockSummaryRows[0]?.inventoryValue || 0;

    const data = {
      generatedAt: new Date(),
      period: { from: movementFrom, to: new Date() },
      stock: {
        ...(stockSummaryRows[0] || {
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
        }),
        inventoryValue: canViewCost(req.user) ? totalValuation : null,
      },
      activeProducts: productCount,
      activeWarehouses: warehouseCount,
      lowStockPositions: lowStockRows[0]?.count || 0,
      movementEffects: canViewCost(req.user)
        ? movementEffects
        : movementEffects.map((e) => ({ ...e, value: null })),
      transfers: transferCounts[0] || { awaitingApproval: 0, approved: 0, inTransit: 0 },
      recentMovements: canViewCost(req.user)
        ? recentMovements
        : recentMovements.map((m) => ({ ...m, totalValue: null })),
    };

    inventoryDashboardCache.set(cacheKey, data);
    return res.json(data);
  } catch (error) {
    return sendError(res, error, "Failed to load the inventory dashboard.");
  }
};

/**
 * 1. ERP-GRADE STOCK LEDGER
 */
export const getProductStockLedger = async (req, res) => {
  try {
    if (!isId(req.params.productId)) return res.status(400).json({ message: "Invalid product ID." });
    const tenantId = req.tenantId;
    const { from, to } = parseDateRange(req.query, { defaultDays: 90, maxDays: 732 });
    const limit = parseLimit(req.query.limit, 50, 200);
    const cursor = decodeCursor(req.query.cursor);

    const product = await Product.findOne({
      _id: req.params.productId,
      ...(tenantId ? { tenantId } : {}),
    })
      .select("name sku barcode imageUrl baseUnit currency status standardCost costingMethod")
      .lean();
    if (!product) return res.status(404).json({ message: "Product not found." });

    const ledger = await calculateProductStockLedger({
      tenantId,
      productId: req.params.productId,
      warehouseId: isId(req.query.warehouse) ? req.query.warehouse : null,
      locationId: isId(req.query.location) ? req.query.location : null,
      from,
      to,
      limit,
      cursor,
    });

    const userCanViewCost = canViewCost(req.user);
    if (!userCanViewCost) {
      ledger.openingBalance.inventoryValue = null;
      ledger.openingBalance.averageCost = null;
      ledger.periodSummary.openingValue = null;
      ledger.periodSummary.totalValueIn = null;
      ledger.periodSummary.totalValueOut = null;
      ledger.periodSummary.closingInventoryValue = null;
      ledger.lines = ledger.lines.map((l) => ({
        ...l,
        unitCost: null,
        valueIn: null,
        valueOut: null,
        runningInventoryValue: null,
      }));
    }

    if (req.query.format === "csv") {
      const headers = [
        { key: "movementDate", label: "Date" },
        { key: "postingDate", label: "Posting Date" },
        { key: "movementNo", label: "Movement No" },
        { key: "movementType", label: "Type" },
        { key: "reference", label: "Reference" },
        { key: "quantityIn", label: "Quantity In" },
        { key: "quantityOut", label: "Quantity Out" },
        ...(userCanViewCost ? [{ key: "unitCost", label: "Unit Cost" }] : []),
        ...(userCanViewCost ? [{ key: "valueIn", label: "Value In" }] : []),
        ...(userCanViewCost ? [{ key: "valueOut", label: "Value Out" }] : []),
        { key: "runningQuantity", label: "Running Quantity" },
        ...(userCanViewCost ? [{ key: "runningInventoryValue", label: "Running Value" }] : []),
      ];
      return sendCsvStream(res, {
        filename: `stock-ledger-${product.sku || product._id}.csv`,
        headers,
        rows: ledger.lines,
      });
    }

    return res.json({
      product,
      ...ledger,
    });
  } catch (error) {
    return sendError(res, error, "Failed to load the product stock ledger.");
  }
};

/**
 * 2. INVENTORY VALUATION REPORT
 */
export const getStockValuationReport = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const limit = parseLimit(req.query.limit, 100, 500);
    const skip = Math.max(Number(req.query.skip) || 0, 0);

    const report = await calculateValuationReport({
      tenantId,
      warehouseId: isId(req.query.warehouse) ? req.query.warehouse : null,
      categoryId: isId(req.query.category) ? req.query.category : null,
      productId: isId(req.query.product) ? req.query.product : null,
      costingMethod: req.query.costingMethod || null,
      asOfDate: req.query.asOfDate || null,
      limit,
      skip,
    });

    const userCanViewCost = canViewCost(req.user);
    if (!userCanViewCost) {
      if (report.summary) report.summary.totalValue = null;
      report.items = (report.items || []).map((item) => ({
        ...item,
        averageCost: null,
        standardCost: null,
        inventoryValue: null,
        unitCost: null,
      }));
    }

    if (req.query.format === "csv") {
      const headers = [
        { key: "productName", label: "Product", format: (_, r) => r.product?.name || r.key || "" },
        { key: "sku", label: "SKU", format: (_, r) => r.product?.sku || "" },
        { key: "warehouseName", label: "Warehouse", format: (_, r) => r.warehouse?.name || "" },
        { key: "costingMethod", label: "Costing Method" },
        { key: "valuationQuantity", label: "Quantity", format: (v, r) => v ?? r.quantity ?? 0 },
        ...(userCanViewCost ? [{ key: "averageCost", label: "Unit Cost", format: (v, r) => v ?? r.unitCost ?? 0 }] : []),
        ...(userCanViewCost ? [{ key: "inventoryValue", label: "Total Value" }] : []),
      ];
      return sendCsvStream(res, {
        filename: "inventory-valuation-report.csv",
        headers,
        rows: report.items,
      });
    }

    return res.json(report);
  } catch (error) {
    return sendError(res, error, "Failed to load the stock valuation report.");
  }
};

/**
 * 3. INVENTORY <-> GENERAL LEDGER RECONCILIATION
 */
export const getInventoryGlReconciliation = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const asOfDate = parseDate(req.query.asOfDate, new Date());

    const result = await reconcileInventoryWithGl({ tenantId, asOfDate });

    if (req.query.format === "csv") {
      const summaryRows = [
        { metric: "Inventory Subledger Value", amount: result.subledgerValue },
        { metric: "GL Inventory Control Account", amount: result.glBalance },
        { metric: "Reconciliation Difference", amount: result.difference },
        { metric: "Reconciliation Status", amount: result.isReconciled ? "RECONCILED" : "MISMATCH" },
      ];
      return sendCsvStream(res, {
        filename: `gl-reconciliation-${asOfDate.toISOString().slice(0, 10)}.csv`,
        headers: [
          { key: "metric", label: "Metric" },
          { key: "amount", label: "Amount / Status" },
        ],
        rows: summaryRows,
      });
    }

    return res.json(result);
  } catch (error) {
    return sendError(res, error, "Failed to load inventory GL reconciliation report.");
  }
};

/**
 * 4. WAREHOUSE-WISE STOCK REPORT
 */
export const getWarehouseStockReport = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const match = {
      status: "active",
      ...(tenantId ? { tenantId: oid(tenantId) } : {}),
    };
    if (isId(req.query.warehouse)) match.warehouse = oid(req.query.warehouse);
    if (isId(req.query.product)) match.product = oid(req.query.product);

    const productIds = await resolveProductIds(req.query, tenantId);
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
        $lookup: { from: "products", localField: "_id.product", foreignField: "_id", as: "product" },
      },
      { $unwind: "$product" },
      {
        $lookup: { from: "warehouses", localField: "_id.warehouse", foreignField: "_id", as: "warehouse" },
      },
      { $unwind: "$warehouse" },
      { $sort: { "warehouse.name": 1, "product.name": 1 } },
      {
        $project: {
          warehouse: { _id: "$warehouse._id", name: "$warehouse.name", code: "$warehouse.code" },
          product: { _id: "$product._id", name: "$product.name", sku: "$product.sku" },
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

    const userCanViewCost = canViewCost(req.user);
    if (!userCanViewCost) {
      rows.forEach((r) => { r.inventoryValue = null; });
    }

    if (req.query.format === "csv") {
      const headers = [
        { key: "warehouse", label: "Warehouse", format: (w) => w?.name || "" },
        { key: "productName", label: "Product", format: (_, r) => r.product?.name || "" },
        { key: "sku", label: "SKU", format: (_, r) => r.product?.sku || "" },
        { key: "onHandQuantity", label: "On Hand" },
        { key: "reservedQuantity", label: "Reserved" },
        { key: "availableQuantity", label: "Available" },
        { key: "quarantineQuantity", label: "Quarantine" },
        { key: "incomingQuantity", label: "Incoming" },
        ...(userCanViewCost ? [{ key: "inventoryValue", label: "Inventory Value" }] : []),
      ];
      return sendCsvStream(res, {
        filename: "warehouse-stock-report.csv",
        headers,
        rows,
      });
    }

    return res.json({ count: rows.length, rows });
  } catch (error) {
    return sendError(res, error, "Failed to load warehouse stock report.");
  }
};

// Backward-compatible alias
export const getWarehouseStockSummary = getWarehouseStockReport;

/**
 * 5. LOCATION / BIN-WISE STOCK REPORT
 */
export const getLocationStockReport = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const limit = parseLimit(req.query.limit, 50, 200);
    const filter = await baseStockFilter(req.query, tenantId);

    const stocks = await ProductStock.find(filter)
      .populate("product", "name sku barcode category")
      .populate("warehouse", "name code")
      .populate("location", "name code zone locationType")
      .sort({ warehouse: 1, location: 1, _id: 1 })
      .limit(limit)
      .lean();

    if (req.query.format === "csv") {
      const headers = [
        { key: "warehouse", label: "Warehouse", format: (w) => w?.name || "" },
        { key: "location", label: "Location / Bin", format: (l) => l?.name || l?.code || "Default Bin" },
        { key: "zone", label: "Zone", format: (_, r) => r.location?.zone || "" },
        { key: "product", label: "Product", format: (p) => p?.name || "" },
        { key: "sku", label: "SKU", format: (_, r) => r.product?.sku || "" },
        { key: "onHandQuantity", label: "On Hand" },
        { key: "reservedQuantity", label: "Reserved" },
        { key: "availableQuantity", label: "Available" },
        { key: "quarantineQuantity", label: "Quarantine" },
      ];
      return sendCsvStream(res, {
        filename: "location-bin-stock-report.csv",
        headers,
        rows: stocks,
      });
    }

    return res.json({ count: stocks.length, rows: stocks });
  } catch (error) {
    return sendError(res, error, "Failed to load location stock report.");
  }
};

/**
 * 6. AVAILABLE VS RESERVED REPORT
 */
export const getAvailableVsReservedReport = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const limit = parseLimit(req.query.limit, 50, 200);
    const filter = await baseStockFilter(req.query, tenantId);

    const stocks = await ProductStock.find(filter)
      .populate("product", "name sku")
      .populate("warehouse", "name code")
      .populate("location", "name code")
      .limit(limit)
      .lean();

    const evaluated = stocks.map((s) => {
      const onHand = num(s.onHandQuantity);
      const reserved = num(s.reservedQuantity);
      const quarantine = num(s.quarantineQuantity);
      const available = num(s.availableQuantity);
      const expected = roundQuantity(onHand - reserved - quarantine);
      const integrityAnomaly =
        Math.abs(expected - available) > 0.0001 || reserved < 0 || (onHand >= 0 && reserved > onHand);

      return {
        _id: s._id,
        product: s.product,
        warehouse: s.warehouse,
        location: s.location,
        onHandQuantity: onHand,
        reservedQuantity: reserved,
        quarantineQuantity: quarantine,
        availableQuantity: available,
        incomingQuantity: num(s.incomingQuantity),
        outgoingQuantity: num(s.outgoingQuantity),
        expectedAvailable: expected,
        hasIntegrityIssue: integrityAnomaly,
      };
    });

    if (req.query.format === "csv") {
      const headers = [
        { key: "product", label: "Product", format: (p) => p?.name || "" },
        { key: "sku", label: "SKU", format: (_, r) => r.product?.sku || "" },
        { key: "warehouse", label: "Warehouse", format: (w) => w?.name || "" },
        { key: "onHandQuantity", label: "On Hand" },
        { key: "reservedQuantity", label: "Reserved" },
        { key: "quarantineQuantity", label: "Quarantine" },
        { key: "availableQuantity", label: "Available" },
        { key: "incomingQuantity", label: "Incoming" },
        { key: "hasIntegrityIssue", label: "Integrity Issue" },
      ];
      return sendCsvStream(res, {
        filename: "available-vs-reserved.csv",
        headers,
        rows: evaluated,
      });
    }

    return res.json({ count: evaluated.length, rows: evaluated });
  } catch (error) {
    return sendError(res, error, "Failed to load available vs reserved report.");
  }
};

/**
 * 7. STOCK MOVEMENT REPORT
 */
export const getStockMovementReport = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { from, to } = parseDateRange(req.query, { defaultDays: 30, maxDays: 366 });
    const limit = parseLimit(req.query.limit, 30, 100);
    const cursor = decodeCursor(req.query.cursor);

    const filter = {
      status: req.query.status && req.query.status !== "all" ? req.query.status : "posted",
      movementDate: { $gte: from, $lte: to },
      ...(tenantId ? { tenantId } : {}),
    };
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
    if (cursor?.date && cursor?.id) {
      filter.$and = [
        ...(filter.$and || []),
        {
          $or: [
            { movementDate: { $lt: new Date(cursor.date) } },
            { movementDate: new Date(cursor.date), _id: { $lt: oid(cursor.id) } },
          ],
        },
      ];
    }

    const movements = await StockMovement.find(filter)
      .select(
        "movementNo movementDate movementType reference sourceType sourceId currency reason products sourceWarehouses destinationWarehouses lineCount totalQuantity totalValue postedAt postedBy accountingStatus journalEntry reversalOf"
      )
      .populate("products", "name sku barcode")
      .populate("sourceWarehouses", "name code")
      .populate("destinationWarehouses", "name code")
      .populate("postedBy", "name email")
      .sort({ movementDate: -1, _id: -1 })
      .limit(limit + 1)
      .lean();

    const hasMore = movements.length > limit;
    if (hasMore) movements.pop();
    const nextCursor =
      hasMore && movements.length
        ? encodeCursor({
            date: movements[movements.length - 1].movementDate,
            id: movements[movements.length - 1]._id,
          })
        : null;

    const userCanViewCost = canViewCost(req.user);
    if (!userCanViewCost) {
      movements.forEach((m) => { m.totalValue = null; });
    }

    if (req.query.format === "csv") {
      const headers = [
        { key: "movementNo", label: "Movement No" },
        { key: "movementDate", label: "Date" },
        { key: "movementType", label: "Type" },
        { key: "reference", label: "Reference" },
        { key: "totalQuantity", label: "Total Quantity" },
        ...(userCanViewCost ? [{ key: "totalValue", label: "Total Value" }] : []),
        { key: "accountingStatus", label: "GL Status" },
      ];
      return sendCsvStream(res, {
        filename: "stock-movements.csv",
        headers,
        rows: movements,
      });
    }

    return res.json({
      period: { from, to },
      count: movements.length,
      hasMore,
      nextCursor,
      movements,
    });
  } catch (error) {
    return sendError(res, error, "Failed to load the stock movement report.");
  }
};

/**
 * 8. STOCK AGING REPORT
 */
export const getStockAgingReport = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const asOfDate = parseDate(req.query.asOfDate, new Date());

    const result = await calculateStockAgingReport({
      tenantId,
      warehouseId: isId(req.query.warehouse) ? req.query.warehouse : null,
      categoryId: isId(req.query.category) ? req.query.category : null,
      productId: isId(req.query.product) ? req.query.product : null,
      asOfDate,
    });

    const userCanViewCost = canViewCost(req.user);
    if (!userCanViewCost) {
      result.summary.totalValue = null;
      result.summary.b0_30 = null;
      result.summary.b31_60 = null;
      result.summary.b61_90 = null;
      result.summary.b91_180 = null;
      result.summary.b181_365 = null;
      result.summary.b365Plus = null;
      result.rows.forEach((r) => {
        r.totalValue = null;
        r.bucket0_30.value = null;
        r.bucket31_60.value = null;
        r.bucket61_90.value = null;
        r.bucket91_180.value = null;
        r.bucket181_365.value = null;
        r.bucket365Plus.value = null;
      });
    }

    if (req.query.format === "csv") {
      const headers = [
        { key: "product", label: "Product", format: (p) => p?.name || "" },
        { key: "sku", label: "SKU", format: (_, r) => r.product?.sku || "" },
        { key: "warehouse", label: "Warehouse", format: (w) => w?.name || "" },
        { key: "totalQuantity", label: "Total Qty" },
        { key: "b0_30_q", label: "0-30 Qty", format: (_, r) => r.bucket0_30?.quantity || 0 },
        { key: "b31_60_q", label: "31-60 Qty", format: (_, r) => r.bucket31_60?.quantity || 0 },
        { key: "b61_90_q", label: "61-90 Qty", format: (_, r) => r.bucket61_90?.quantity || 0 },
        { key: "b91_180_q", label: "91-180 Qty", format: (_, r) => r.bucket91_180?.quantity || 0 },
        { key: "b181_365_q", label: "181-365 Qty", format: (_, r) => r.bucket181_365?.quantity || 0 },
        { key: "b365_q", label: "365+ Qty", format: (_, r) => r.bucket365Plus?.quantity || 0 },
      ];
      return sendCsvStream(res, {
        filename: "stock-aging-report.csv",
        headers,
        rows: result.rows,
      });
    }

    return res.json(result);
  } catch (error) {
    return sendError(res, error, "Failed to load stock aging report.");
  }
};

/**
 * 9. SLOW / NON-MOVING INVENTORY REPORT
 */
export const getSlowMovingReport = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const daysThreshold = Number(req.query.days) || 90;
    const limit = parseLimit(req.query.limit, 50, 200);
    const skip = Math.max(Number(req.query.skip) || 0, 0);

    const result = await calculateSlowMovingReport({
      tenantId,
      warehouseId: isId(req.query.warehouse) ? req.query.warehouse : null,
      daysThreshold,
      limit,
      skip,
    });

    const userCanViewCost = canViewCost(req.user);
    if (!userCanViewCost) {
      result.rows.forEach((r) => {
        r.averageCost = null;
        r.inventoryValue = null;
      });
    }

    if (req.query.format === "csv") {
      const headers = [
        { key: "product", label: "Product", format: (p) => p?.name || "" },
        { key: "sku", label: "SKU", format: (_, r) => r.product?.sku || "" },
        { key: "warehouse", label: "Warehouse", format: (w) => w?.name || "" },
        { key: "onHandQuantity", label: "On Hand" },
        { key: "daysInactive", label: "Days Inactive" },
        { key: "classification", label: "Classification" },
      ];
      return sendCsvStream(res, {
        filename: "slow-non-moving-inventory.csv",
        headers,
        rows: result.rows,
      });
    }

    return res.json(result);
  } catch (error) {
    return sendError(res, error, "Failed to load slow-moving inventory report.");
  }
};

/**
 * 10. LOW STOCK / REORDER REPORT
 */
export const getLowStockReport = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const limit = parseLimit(req.query.limit, 50, 200);
    const cursor = decodeCursor(req.query.cursor);

    const match = {
      status: "active",
      ...(tenantId ? { tenantId: oid(tenantId) } : {}),
    };
    if (isId(req.query.warehouse)) match.warehouse = oid(req.query.warehouse);
    if (isId(req.query.product)) match.product = oid(req.query.product);
    if (cursor?.id) match._id = { $gt: oid(cursor.id) };

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
            {
              $project: {
                name: 1,
                sku: 1,
                barcode: 1,
                imageUrl: 1,
                reorderLevel: 1,
                minimumStock: 1,
                maximumStock: 1,
                generalOrderQuantity: 1,
              },
            },
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
        $project: {
          product: 1,
          warehouse: { _id: "$warehouse._id", name: "$warehouse.name", code: "$warehouse.code" },
          onHandQuantity: 1,
          availableQuantity: 1,
          reservedQuantity: 1,
          incomingQuantity: 1,
          effectiveReorderLevel: 1,
          shortageQuantity: {
            $max: [{ $subtract: ["$effectiveReorderLevel", "$availableQuantity"] }, 0],
          },
          suggestedPurchaseQuantity: {
            $let: {
              vars: {
                shortage: { $max: [{ $subtract: ["$effectiveReorderLevel", "$availableQuantity"] }, 0] },
                orderQty: { $ifNull: ["$product.generalOrderQuantity", 0] },
              },
              in: {
                $cond: [
                  { $gt: ["$$orderQty", 0] },
                  { $multiply: [{ $ceil: { $divide: ["$$shortage", "$$orderQty"] } }, "$$orderQty"] },
                  "$$shortage",
                ],
              },
            },
          },
          inventoryValue: 1,
        },
      },
    ]);

    const hasMore = rows.length > limit;
    if (hasMore) rows.pop();
    const nextCursor = hasMore && rows.length ? encodeCursor({ id: rows[rows.length - 1]._id }) : null;

    const userCanViewCost = canViewCost(req.user);
    if (!userCanViewCost) {
      rows.forEach((r) => { r.inventoryValue = null; });
    }

    if (req.query.format === "csv") {
      const headers = [
        { key: "product", label: "Product", format: (p) => p?.name || "" },
        { key: "sku", label: "SKU", format: (_, r) => r.product?.sku || "" },
        { key: "warehouse", label: "Warehouse", format: (w) => w?.name || "" },
        { key: "availableQuantity", label: "Available" },
        { key: "effectiveReorderLevel", label: "Reorder Level" },
        { key: "shortageQuantity", label: "Shortage" },
        { key: "suggestedPurchaseQuantity", label: "Suggested Reorder Qty" },
      ];
      return sendCsvStream(res, {
        filename: "low-stock-reorder-report.csv",
        headers,
        rows,
      });
    }

    return res.json({ count: rows.length, hasMore, nextCursor, rows });
  } catch (error) {
    return sendError(res, error, "Failed to load the low-stock report.");
  }
};

/**
 * 11. BATCH & EXPIRY REPORTING
 */
export const getBatchExpiryReport = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const filter = {
      tenantId: oid(tenantId),
      trackingType: "batch",
    };
    if (isId(req.query.product)) filter.product = oid(req.query.product);
    if (isId(req.query.warehouse)) filter.warehouse = oid(req.query.warehouse);

    const now = new Date();
    const expiryInterval = req.query.expiryInterval;
    if (expiryInterval === "expired") {
      filter.expiryDate = { $lt: now };
    } else if (expiryInterval === "7_days") {
      filter.expiryDate = { $gte: now, $lte: new Date(now.getTime() + 7 * 86400000) };
    } else if (expiryInterval === "30_days") {
      filter.expiryDate = { $gte: now, $lte: new Date(now.getTime() + 30 * 86400000) };
    } else if (expiryInterval === "60_days") {
      filter.expiryDate = { $gte: now, $lte: new Date(now.getTime() + 60 * 86400000) };
    } else if (expiryInterval === "90_days") {
      filter.expiryDate = { $gte: now, $lte: new Date(now.getTime() + 90 * 86400000) };
    }

    const batches = await InventoryTracking.find(filter)
      .populate("product", "name sku")
      .populate("warehouse", "name code")
      .populate("location", "name code")
      .sort({ expiryDate: 1, _id: 1 })
      .lean();

    if (req.query.format === "csv") {
      const headers = [
        { key: "trackingReference", label: "Batch Number" },
        { key: "product", label: "Product", format: (p) => p?.name || "" },
        { key: "warehouse", label: "Warehouse", format: (w) => w?.name || "" },
        { key: "remainingQuantity", label: "Remaining Quantity" },
        { key: "expiryDate", label: "Expiry Date" },
        { key: "status", label: "Status" },
      ];
      return sendCsvStream(res, {
        filename: "batch-expiry-report.csv",
        headers,
        rows: batches,
      });
    }

    return res.json({ count: batches.length, rows: batches });
  } catch (error) {
    return sendError(res, error, "Failed to load batch expiry report.");
  }
};

/**
 * 12. SERIAL NUMBER REPORTING
 */
export const getSerialNumberReport = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const filter = {
      tenantId: oid(tenantId),
      trackingType: "serial",
    };
    if (isId(req.query.product)) filter.product = oid(req.query.product);
    if (isId(req.query.warehouse)) filter.warehouse = oid(req.query.warehouse);
    if (req.query.serialNumber) filter.trackingReference = clean(req.query.serialNumber);

    const serials = await InventoryTracking.find(filter)
      .populate("product", "name sku")
      .populate("warehouse", "name code")
      .populate("location", "name code")
      .sort({ createdAt: -1 })
      .lean();

    if (req.query.format === "csv") {
      const headers = [
        { key: "trackingReference", label: "Serial Number" },
        { key: "product", label: "Product", format: (p) => p?.name || "" },
        { key: "warehouse", label: "Warehouse", format: (w) => w?.name || "" },
        { key: "location", label: "Location", format: (l) => l?.name || "" },
        { key: "qualityState", label: "Status" },
      ];
      return sendCsvStream(res, {
        filename: "serial-numbers.csv",
        headers,
        rows: serials,
      });
    }

    return res.json({ count: serials.length, rows: serials });
  } catch (error) {
    return sendError(res, error, "Failed to load serial numbers report.");
  }
};

/**
 * 13. STOCK ADJUSTMENT REPORT
 */
export const getStockAdjustmentReport = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { from, to } = parseDateRange(req.query, { defaultDays: 60, maxDays: 366 });
    const filter = {
      adjustmentDate: { $gte: from, $lte: to },
      ...(tenantId ? { tenantId } : {}),
    };
    if (req.query.status && req.query.status !== "all") filter.status = req.query.status;
    if (req.query.adjustmentType && req.query.adjustmentType !== "all") filter.adjustmentType = req.query.adjustmentType;
    if (isId(req.query.warehouse)) filter.warehouse = req.query.warehouse;

    const adjustments = await StockAdjustment.find(filter)
      .populate("warehouse", "name code")
      .populate("approvedBy createdBy", "name email")
      .sort({ adjustmentDate: -1 })
      .lean();

    const userCanViewCost = canViewCost(req.user);
    if (!userCanViewCost) {
      adjustments.forEach((a) => {
        a.totalCostVariance = null;
        (a.lines || []).forEach((l) => {
          l.unitCost = null;
          l.costVariance = null;
        });
      });
    }

    if (req.query.format === "csv") {
      const headers = [
        { key: "adjustmentNo", label: "Adjustment No" },
        { key: "adjustmentDate", label: "Date" },
        { key: "adjustmentType", label: "Type" },
        { key: "warehouse", label: "Warehouse", format: (w) => w?.name || "" },
        { key: "totalQuantityVariance", label: "Qty Variance" },
        ...(userCanViewCost ? [{ key: "totalCostVariance", label: "Cost Variance" }] : []),
        { key: "status", label: "Status" },
      ];
      return sendCsvStream(res, {
        filename: "stock-adjustments.csv",
        headers,
        rows: adjustments,
      });
    }

    return res.json({ count: adjustments.length, adjustments });
  } catch (error) {
    return sendError(res, error, "Failed to load stock adjustment report.");
  }
};

/**
 * 14. PHYSICAL COUNT / CYCLE COUNT REPORT (zero-variance preserved)
 */
export const getStockCountReport = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const filter = {
      adjustmentType: { $in: ["physical_count", "cycle_count"] },
      ...(tenantId ? { tenantId } : {}),
    };
    if (isId(req.query.warehouse)) filter.warehouse = req.query.warehouse;

    const countAudits = await StockAdjustment.find(filter)
      .populate("warehouse", "name code")
      .populate("lines.product", "name sku")
      .populate("approvedBy createdBy", "name email")
      .sort({ adjustmentDate: -1 })
      .lean();

    // Flatten lines to show counted items with zero variance clearly
    const countLines = [];
    countAudits.forEach((audit) => {
      (audit.lines || []).forEach((line) => {
        countLines.push({
          auditNo: audit.adjustmentNo,
          auditDate: audit.adjustmentDate,
          auditType: audit.adjustmentType,
          status: audit.status,
          warehouse: audit.warehouse,
          product: line.product,
          systemQuantity: line.systemQuantity,
          countedQuantity: line.countedQuantity,
          varianceQuantity: line.quantityVariance,
          varianceValue: line.costVariance,
          countedAt: audit.createdAt,
          approvedBy: audit.approvedBy,
          movementId: audit.stockMovement,
        });
      });
    });

    const userCanViewCost = canViewCost(req.user);
    if (!userCanViewCost) {
      countLines.forEach((l) => { l.varianceValue = null; });
    }

    if (req.query.format === "csv") {
      const headers = [
        { key: "auditNo", label: "Count No" },
        { key: "auditDate", label: "Date" },
        { key: "warehouse", label: "Warehouse", format: (w) => w?.name || "" },
        { key: "product", label: "Product", format: (p) => p?.name || "" },
        { key: "sku", label: "SKU", format: (_, r) => r.product?.sku || "" },
        { key: "systemQuantity", label: "System Qty" },
        { key: "countedQuantity", label: "Counted Qty" },
        { key: "varianceQuantity", label: "Variance Qty" },
        ...(userCanViewCost ? [{ key: "varianceValue", label: "Variance Value" }] : []),
      ];
      return sendCsvStream(res, {
        filename: "stock-count-audits.csv",
        headers,
        rows: countLines,
      });
    }

    return res.json({ count: countLines.length, rows: countLines });
  } catch (error) {
    return sendError(res, error, "Failed to load stock count report.");
  }
};

/**
 * 15. TRANSFER REPORTING
 */
export const getStockTransferReport = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const filter = { ...(tenantId ? { tenantId } : {}) };
    if (req.query.status && req.query.status !== "all") filter.status = req.query.status;
    if (isId(req.query.sourceWarehouse)) filter.sourceWarehouse = req.query.sourceWarehouse;
    if (isId(req.query.destinationWarehouse)) filter.destinationWarehouse = req.query.destinationWarehouse;

    const transfers = await StockTransfer.find(filter)
      .populate("sourceWarehouse destinationWarehouse", "name code")
      .populate("approvedBy createdBy", "name email")
      .sort({ createdAt: -1 })
      .lean();

    if (req.query.format === "csv") {
      const headers = [
        { key: "transferNo", label: "Transfer No" },
        { key: "transferDate", label: "Date" },
        { key: "sourceWarehouse", label: "Source", format: (w) => w?.name || "" },
        { key: "destinationWarehouse", label: "Destination", format: (w) => w?.name || "" },
        { key: "totalRequestedQuantity", label: "Requested Qty" },
        { key: "totalDispatchedQuantity", label: "Dispatched Qty" },
        { key: "totalReceivedQuantity", label: "Received Qty" },
        { key: "status", label: "Status" },
      ];
      return sendCsvStream(res, {
        filename: "stock-transfers.csv",
        headers,
        rows: transfers,
      });
    }

    return res.json({ count: transfers.length, transfers });
  } catch (error) {
    return sendError(res, error, "Failed to load stock transfer report.");
  }
};

/**
 * 16. INVENTORY LOSS REPORT
 */
export const getInventoryLossReport = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const filter = { ...(tenantId ? { tenantId } : {}) };
    if (req.query.lossType && req.query.lossType !== "all") filter.lossType = req.query.lossType;
    if (isId(req.query.warehouse)) filter.warehouse = req.query.warehouse;
    if (isId(req.query.product)) filter.product = req.query.product;

    const losses = await InventoryLoss.find(filter)
      .populate("product", "name sku")
      .populate("warehouse", "name code")
      .populate("location", "name code")
      .populate("recordedBy approvedBy", "name email")
      .sort({ lossDate: -1 })
      .lean();

    const userCanViewCost = canViewCost(req.user);
    if (!userCanViewCost) {
      losses.forEach((l) => {
        l.unitCost = null;
        l.lossValue = null;
      });
    }

    if (req.query.format === "csv") {
      const headers = [
        { key: "lossReference", label: "Reference" },
        { key: "lossType", label: "Loss Type" },
        { key: "product", label: "Product", format: (p) => p?.name || "" },
        { key: "warehouse", label: "Warehouse", format: (w) => w?.name || "" },
        { key: "quantity", label: "Quantity" },
        ...(userCanViewCost ? [{ key: "unitCost", label: "Unit Cost" }] : []),
        ...(userCanViewCost ? [{ key: "lossValue", label: "Loss Value" }] : []),
        { key: "reason", label: "Reason" },
      ];
      return sendCsvStream(res, {
        filename: "inventory-losses.csv",
        headers,
        rows: losses,
      });
    }

    return res.json({ count: losses.length, losses });
  } catch (error) {
    return sendError(res, error, "Failed to load inventory loss report.");
  }
};

/**
 * 28. DATA CONSISTENCY & INTEGRITY CHECK (Administrative)
 */
export const getInventoryIntegrityCheck = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const result = await runInventoryIntegrityDiagnostic({ tenantId });
    return res.json(result);
  } catch (error) {
    return sendError(res, error, "Failed to run inventory integrity diagnostic.");
  }
};

/**
 * 29. RECONCILIATION & REPAIR TOOLS (Administrative, Dry-Run Capable)
 */
export const executeInventoryRepair = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const dryRun = req.body.dryRun !== false;

    const result = await executeInventoryRepairPlan({
      tenantId,
      dryRun,
      userId: req.user?._id || null,
    });

    return res.json({
      message: dryRun
        ? "Inventory repair plan generated in dry-run mode (no changes applied)."
        : "Inventory repair plan executed successfully.",
      ...result,
    });
  } catch (error) {
    return sendError(res, error, "Failed to execute inventory repair plan.");
  }
};

/**
 * 27. UNIFIED REPORT EXPORT
 */
export const exportInventoryReport = async (req, res) => {
  const reportType = req.params.reportType;
  req.query.format = "csv";

  switch (reportType) {
    case "ledger":
      return getProductStockLedger(req, res);
    case "valuation":
      return getStockValuationReport(req, res);
    case "gl-reconciliation":
      return getInventoryGlReconciliation(req, res);
    case "warehouse-stock":
      return getWarehouseStockReport(req, res);
    case "location-stock":
      return getLocationStockReport(req, res);
    case "available-vs-reserved":
      return getAvailableVsReservedReport(req, res);
    case "movements":
      return getStockMovementReport(req, res);
    case "aging":
      return getStockAgingReport(req, res);
    case "slow-moving":
      return getSlowMovingReport(req, res);
    case "low-stock":
      return getLowStockReport(req, res);
    case "batch-expiry":
      return getBatchExpiryReport(req, res);
    case "serial-numbers":
      return getSerialNumberReport(req, res);
    case "adjustments":
      return getStockAdjustmentReport(req, res);
    case "counts":
      return getStockCountReport(req, res);
    case "transfers":
      return getStockTransferReport(req, res);
    case "losses":
      return getInventoryLossReport(req, res);
    default:
      return res.status(400).json({ message: `Unknown report export type: ${reportType}` });
  }
};

// Current stock report preserving existing behavior
export const getCurrentStockReport = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const limit = parseLimit(req.query.limit, 50, 200);
    const cursor = decodeCursor(req.query.cursor);

    const filter = await baseStockFilter(req.query, tenantId);
    if (cursor?.id) filter._id = { $gt: oid(cursor.id) };

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
    const nextCursor = hasMore && stocks.length ? encodeCursor({ id: stocks[stocks.length - 1]._id }) : null;

    const userCanViewCost = canViewCost(req.user);
    if (!userCanViewCost) {
      stocks.forEach((s) => {
        s.averageCost = null;
        s.inventoryValue = null;
      });
    }

    if (req.query.format === "csv") {
      const headers = [
        { key: "product", label: "Product", format: (p) => p?.name || "" },
        { key: "sku", label: "SKU", format: (_, r) => r.product?.sku || "" },
        { key: "warehouse", label: "Warehouse", format: (w) => w?.name || "" },
        { key: "location", label: "Location", format: (l) => l?.name || "" },
        { key: "onHandQuantity", label: "On Hand" },
        { key: "reservedQuantity", label: "Reserved" },
        { key: "availableQuantity", label: "Available" },
        ...(userCanViewCost ? [{ key: "averageCost", label: "Average Cost" }] : []),
        ...(userCanViewCost ? [{ key: "inventoryValue", label: "Inventory Value" }] : []),
      ];
      return sendCsvStream(res, {
        filename: "current-stock.csv",
        headers,
        rows: stocks,
      });
    }

    return res.json({ count: stocks.length, hasMore, nextCursor, stocks });
  } catch (error) {
    return sendError(res, error, "Failed to load the current stock report.");
  }
};
