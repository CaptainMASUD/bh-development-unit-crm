import mongoose from "mongoose";
import Product from "../../models/inventory/product.model.js";
import ProductStock from "../../models/inventory/productStock.model.js";
import StockMovement from "../../models/inventory/stockMovement.model.js";
import StockTransfer from "../../models/inventory/stockTransfer.model.js";
import StockAdjustment from "../../models/inventory/stockAdjustment.model.js";
import InventoryValuation from "../../models/inventory/inventoryValuation.model.js";
import FifoCostLayer from "../../models/inventory/fifoCostLayer.model.js";
import {
  InventoryLoss,
  InventoryPreference,
  InventoryTracking,
  WarehouseCheck,
} from "../../models/inventory/inventoryOperations.model.js";
import JournalEntry from "../../models/journalEntry.model.js";
import Account from "../../models/account.model.js";
import AccountingSettings from "../../models/accountingSettings.model.js";
import { resolveAccountingAccount } from "../../services/accountingPosting.service.js";
import { writeAudit } from "../../utils/audit.js";

const isId = (val) => mongoose.Types.ObjectId.isValid(String(val || ""));
const oid = (val) => new mongoose.Types.ObjectId(String(val));
const num = (val) => Number(val || 0);
const roundQuantity = (val) => Math.round((num(val) + Number.EPSILON) * 1e6) / 1e6;
const roundMoney = (val) => Math.round((num(val) + Number.EPSILON) * 1e4) / 1e4;
const roundGL = (val) => Math.round((num(val) + Number.EPSILON) * 100) / 100;

export const parseLimit = (value, fallback = 50, max = 500) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.trunc(parsed), 1), max);
};

export const parseDate = (value, fallback = null) => {
  if (!value) return fallback;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const parseDateRange = (query = {}, { defaultDays = 30, maxDays = 732 } = {}) => {
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

// Cursor helpers
export const encodeCursor = (payload) =>
  Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");

export const decodeCursor = (token) => {
  try {
    if (!token) return null;
    return JSON.parse(Buffer.from(String(token), "base64url").toString("utf8"));
  } catch {
    return null;
  }
};

/**
 * 1. ERP-Grade Stock Ledger with Opening Balance, Running Balance, and Period Summary.
 */
export const calculateProductStockLedger = async ({
  tenantId,
  productId,
  warehouseId = null,
  locationId = null,
  from,
  to,
  limit = 50,
  cursor = null,
}) => {
  const tid = oid(tenantId);
  const pid = oid(productId);

  // 1. Calculate Opening Balance prior to `from`
  const priorMovementMatch = {
    tenantId: tid,
    products: pid,
    status: "posted",
    movementDate: { $lt: from },
  };

  const lineFilter = { "lines.product": pid };
  if (warehouseId) {
    lineFilter.$or = [
      { "lines.sourceWarehouse": oid(warehouseId) },
      { "lines.destinationWarehouse": oid(warehouseId) },
    ];
  }
  if (locationId) {
    lineFilter.$or = [
      { "lines.sourceLocation": oid(locationId) },
      { "lines.destinationLocation": oid(locationId) },
    ];
  }

  const priorSummaryRows = await StockMovement.aggregate([
    { $match: priorMovementMatch },
    { $unwind: "$lines" },
    { $match: lineFilter },
    {
      $project: {
        effect: "$lines.effect",
        quantity: "$lines.quantity",
        appliedValue: "$lines.appliedValue",
        sourceWarehouse: "$lines.sourceWarehouse",
        destinationWarehouse: "$lines.destinationWarehouse",
      },
    },
  ]);

  let openingQuantity = 0;
  let openingInventoryValue = 0;

  for (const row of priorSummaryRows) {
    const qty = num(row.quantity);
    const val = num(row.appliedValue);
    if (warehouseId) {
      const isSrc = String(row.sourceWarehouse) === String(warehouseId);
      const isDest = String(row.destinationWarehouse) === String(warehouseId);
      if (row.effect === "in" || isDest) {
        openingQuantity = roundQuantity(openingQuantity + qty);
        openingInventoryValue = roundMoney(openingInventoryValue + val);
      } else if (row.effect === "out" || isSrc) {
        openingQuantity = roundQuantity(openingQuantity - qty);
        openingInventoryValue = roundMoney(openingInventoryValue - val);
      }
    } else {
      if (row.effect === "in") {
        openingQuantity = roundQuantity(openingQuantity + qty);
        openingInventoryValue = roundMoney(openingInventoryValue + val);
      } else if (row.effect === "out") {
        openingQuantity = roundQuantity(openingQuantity - qty);
        openingInventoryValue = roundMoney(openingInventoryValue - val);
      }
    }
  }

  const openingAverageCost =
    openingQuantity > 0 ? roundMoney(openingInventoryValue / openingQuantity) : 0;

  // 2. Fetch Period Movement Lines sorted chronologically
  const periodMovementMatch = {
    tenantId: tid,
    products: pid,
    status: "posted",
    movementDate: { $gte: from, $lte: to },
  };

  const periodPipeline = [
    { $match: periodMovementMatch },
    { $unwind: "$lines" },
    { $match: lineFilter },
    { $sort: { movementDate: 1, _id: 1, "lines._id": 1 } },
    {
      $lookup: {
        from: "warehouses",
        localField: "lines.sourceWarehouse",
        foreignField: "_id",
        as: "srcWh",
      },
    },
    {
      $lookup: {
        from: "warehouses",
        localField: "lines.destinationWarehouse",
        foreignField: "_id",
        as: "destWh",
      },
    },
    {
      $lookup: {
        from: "warehouselocations",
        localField: "lines.sourceLocation",
        foreignField: "_id",
        as: "srcLoc",
      },
    },
    {
      $lookup: {
        from: "warehouselocations",
        localField: "lines.destinationLocation",
        foreignField: "_id",
        as: "destLoc",
      },
    },
    {
      $project: {
        movementNo: 1,
        movementDate: 1,
        postingDate: { $ifNull: ["$postingDate", "$movementDate"] },
        movementType: 1,
        reference: 1,
        sourceType: 1,
        sourceId: 1,
        reason: 1,
        journalEntry: 1,
        line: "$lines",
        sourceWarehouse: { $arrayElemAt: ["$srcWh", 0] },
        destinationWarehouse: { $arrayElemAt: ["$destWh", 0] },
        sourceLocation: { $arrayElemAt: ["$srcLoc", 0] },
        destinationLocation: { $arrayElemAt: ["$destLoc", 0] },
      },
    },
  ];

  const allPeriodRows = await StockMovement.aggregate(periodPipeline);

  // 3. Compute running balances sequentially across all rows
  let runningQuantity = openingQuantity;
  let runningInventoryValue = openingInventoryValue;
  let totalQuantityIn = 0;
  let totalQuantityOut = 0;
  let totalValueIn = 0;
  let totalValueOut = 0;

  const processedRows = allPeriodRows.map((doc) => {
    const qty = num(doc.line.quantity);
    const unitCost = num(doc.line.appliedUnitCost);
    const lineVal = num(doc.line.appliedValue) || roundMoney(qty * unitCost);

    let quantityIn = 0;
    let quantityOut = 0;
    let valueIn = 0;
    let valueOut = 0;

    if (warehouseId) {
      const isSrc = String(doc.line.sourceWarehouse) === String(warehouseId);
      const isDest = String(doc.line.destinationWarehouse) === String(warehouseId);
      if (doc.line.effect === "in" || isDest) {
        quantityIn = qty;
        valueIn = lineVal;
      } else if (doc.line.effect === "out" || isSrc) {
        quantityOut = qty;
        valueOut = lineVal;
      }
    } else {
      if (doc.line.effect === "in") {
        quantityIn = qty;
        valueIn = lineVal;
      } else if (doc.line.effect === "out") {
        quantityOut = qty;
        valueOut = lineVal;
      }
    }

    totalQuantityIn = roundQuantity(totalQuantityIn + quantityIn);
    totalQuantityOut = roundQuantity(totalQuantityOut + quantityOut);
    totalValueIn = roundMoney(totalValueIn + valueIn);
    totalValueOut = roundMoney(totalValueOut + valueOut);

    runningQuantity = roundQuantity(runningQuantity + quantityIn - quantityOut);
    runningInventoryValue = roundMoney(runningInventoryValue + valueIn - valueOut);

    return {
      _id: doc.line._id,
      movementId: doc._id,
      movementNo: doc.movementNo,
      movementDate: doc.movementDate,
      postingDate: doc.postingDate,
      movementType: doc.movementType,
      reference: doc.reference,
      sourceType: doc.sourceType,
      reason: doc.reason,
      journalEntry: doc.journalEntry,
      warehouse: quantityIn > 0 ? doc.destinationWarehouse : doc.sourceWarehouse,
      location: quantityIn > 0 ? doc.destinationLocation : doc.sourceLocation,
      sourceWarehouse: doc.sourceWarehouse,
      destinationWarehouse: doc.destinationWarehouse,
      quantityIn,
      quantityOut,
      unitCost,
      valueIn,
      valueOut,
      runningQuantity,
      runningInventoryValue,
      lotNumber: doc.line.lotNumber || "",
      serialNumbers: doc.line.serialNumbers || [],
    };
  });

  // 4. Cursor Pagination over processedRows
  let startIndex = 0;
  if (cursor && cursor.lineId) {
    const foundIndex = processedRows.findIndex((r) => String(r._id) === String(cursor.lineId));
    if (foundIndex >= 0) {
      startIndex = foundIndex + 1;
    }
  }

  const pagedRows = processedRows.slice(startIndex, startIndex + limit);
  const hasMore = startIndex + limit < processedRows.length;
  const nextCursor =
    hasMore && pagedRows.length
      ? encodeCursor({
          date: pagedRows[pagedRows.length - 1].movementDate,
          movementId: pagedRows[pagedRows.length - 1].movementId,
          lineId: pagedRows[pagedRows.length - 1]._id,
        })
      : null;

  const netMovement = roundQuantity(totalQuantityIn - totalQuantityOut);
  const closingQuantity = roundQuantity(openingQuantity + netMovement);
  const closingInventoryValue = roundMoney(openingInventoryValue + totalValueIn - totalValueOut);

  return {
    period: { from, to },
    openingBalance: {
      quantity: openingQuantity,
      inventoryValue: openingInventoryValue,
      averageCost: openingAverageCost,
    },
    periodSummary: {
      openingQuantity,
      totalQuantityIn,
      totalQuantityOut,
      netMovement,
      closingQuantity,
      openingValue: openingInventoryValue,
      totalValueIn,
      totalValueOut,
      closingInventoryValue,
    },
    count: pagedRows.length,
    totalLines: processedRows.length,
    hasMore,
    nextCursor,
    lines: pagedRows,
  };
};

/**
 * 2. Inventory Valuation Report (backed by InventoryValuation).
 */
export const calculateValuationReport = async ({
  tenantId,
  warehouseId = null,
  categoryId = null,
  productId = null,
  costingMethod = null,
  asOfDate = null,
  limit = 100,
  skip = 0,
}) => {
  const tid = oid(tenantId);
  const match = { tenantId: tid };
  if (warehouseId && isId(warehouseId)) match.warehouse = oid(warehouseId);
  if (productId && isId(productId)) match.product = oid(productId);
  if (costingMethod) match.costingMethod = costingMethod;

  // Filter by category if supplied
  if (categoryId && isId(categoryId)) {
    const matchingProducts = await Product.find({
      tenantId: tid,
      category: categoryId,
    })
      .select("_id")
      .lean();
    match.product = { $in: matchingProducts.map((p) => p._id) };
  }

  // If asOfDate is provided, calculate historical valuation from stock movements
  if (asOfDate && !Number.isNaN(new Date(asOfDate).getTime())) {
    const targetDate = new Date(asOfDate);
    const movementMatch = {
      tenantId: tid,
      status: "posted",
      movementDate: { $lte: targetDate },
    };
    if (productId && isId(productId)) movementMatch.products = oid(productId);

    const historicalLines = await StockMovement.aggregate([
      { $match: movementMatch },
      { $unwind: "$lines" },
      ...(warehouseId && isId(warehouseId)
        ? [
            {
              $match: {
                $or: [
                  { "lines.sourceWarehouse": oid(warehouseId) },
                  { "lines.destinationWarehouse": oid(warehouseId) },
                ],
              },
            },
          ]
        : []),
      {
        $group: {
          _id: { product: "$lines.product", warehouse: "$lines.destinationWarehouse" },
          totalInQty: {
            $sum: { $cond: [{ $eq: ["$lines.effect", "in"] }, "$lines.quantity", 0] },
          },
          totalOutQty: {
            $sum: { $cond: [{ $eq: ["$lines.effect", "out"] }, "$lines.quantity", 0] },
          },
          totalInVal: {
            $sum: { $cond: [{ $eq: ["$lines.effect", "in"] }, "$lines.appliedValue", 0] },
          },
          totalOutVal: {
            $sum: { $cond: [{ $eq: ["$lines.effect", "out"] }, "$lines.appliedValue", 0] },
          },
        },
      },
    ]);

    const valuationMap = new Map();
    historicalLines.forEach((row) => {
      const pidStr = String(row._id.product);
      const whStr = String(row._id.warehouse);
      const qty = roundQuantity(row.totalInQty - row.totalOutQty);
      const val = roundMoney(row.totalInVal - row.totalOutVal);
      if (qty > 0) {
        valuationMap.set(`${pidStr}:${whStr}`, {
          quantity: qty,
          inventoryValue: Math.max(0, val),
          unitCost: roundMoney(val / qty),
        });
      }
    });

    return {
      asOfDate: targetDate,
      isHistorical: true,
      items: Array.from(valuationMap.entries()).map(([k, v]) => ({
        key: k,
        ...v,
      })),
    };
  }

  // Current valuation directly from InventoryValuation
  const [items, total, summary] = await Promise.all([
    InventoryValuation.find(match)
      .populate("product", "name sku barcode category brand baseUnit status standardCost")
      .populate("warehouse", "name code warehouseType status")
      .sort({ inventoryValue: -1, _id: 1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    InventoryValuation.countDocuments(match),
    InventoryValuation.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          totalQuantity: { $sum: "$valuationQuantity" },
          totalValue: { $sum: "$inventoryValue" },
          count: { $sum: 1 },
        },
      },
    ]),
  ]);

  return {
    asOfDate: new Date(),
    isHistorical: false,
    summary: summary[0] || { totalQuantity: 0, totalValue: 0, count: 0 },
    total,
    skip,
    limit,
    items,
  };
};

/**
 * 3. Inventory <-> General Ledger Reconciliation.
 */
export const reconcileInventoryWithGl = async ({ tenantId, asOfDate = new Date() }) => {
  const tid = oid(tenantId);
  const targetDate = new Date(asOfDate);

  // 1. Subledger Value from InventoryValuation
  const subledgerAgg = await InventoryValuation.aggregate([
    { $match: { tenantId: tid } },
    {
      $group: {
        _id: null,
        totalValuationQuantity: { $sum: "$valuationQuantity" },
        totalInventoryValue: { $sum: "$inventoryValue" },
        positionsCount: { $sum: 1 },
      },
    },
  ]);
  const subledgerValue = roundGL(subledgerAgg[0]?.totalInventoryValue || 0);

  // 2. GL Balance from JournalEntry on Inventory Control Account (1300)
  const inventoryAccount = await resolveAccountingAccount({
    tenantId: tid,
    settingsField: "inventoryAccount",
    fallbackCode: "1300",
  });

  const glAgg = await JournalEntry.aggregate([
    {
      $match: {
        tenantId: tid,
        status: "posted",
        date: { $lte: targetDate },
        "lines.account": inventoryAccount._id,
      },
    },
    { $unwind: "$lines" },
    { $match: { "lines.account": inventoryAccount._id } },
    {
      $group: {
        _id: null,
        totalDebit: { $sum: "$lines.debit" },
        totalCredit: { $sum: "$lines.credit" },
      },
    },
  ]);

  const totalDebit = roundGL(glAgg[0]?.totalDebit || 0);
  const totalCredit = roundGL(glAgg[0]?.totalCredit || 0);
  const glBalance = roundGL(totalDebit - totalCredit);
  const difference = roundGL(subledgerValue - glBalance);

  // 3. Traceable Diagnostics
  const [unpostedMovements, manualGlEntries, orphanedJournals, stockValuationDiscrepancies] =
    await Promise.all([
      // Unposted movements missing journalEntry
      StockMovement.find({
        tenantId: tid,
        status: "posted",
        movementDate: { $lte: targetDate },
        accountingStatus: { $in: ["pending", "error", "not_applicable"] },
        totalValue: { $gt: 0 },
      })
        .select("movementNo movementDate movementType reference totalQuantity totalValue accountingStatus")
        .limit(20)
        .lean(),

      // Manual GL entries hitting Account 1300 directly without an inventory movement
      JournalEntry.find({
        tenantId: tid,
        status: "posted",
        date: { $lte: targetDate },
        inventoryMovement: null,
        "lines.account": inventoryAccount._id,
      })
        .select("entryNo date voucherType sourceType reference memo lines")
        .limit(20)
        .lean(),

      // Journal entries pointing to non-existent inventoryMovement
      JournalEntry.aggregate([
        {
          $match: {
            tenantId: tid,
            status: "posted",
            inventoryMovement: { $ne: null },
          },
        },
        {
          $lookup: {
            from: "stockmovements",
            localField: "inventoryMovement",
            foreignField: "_id",
            as: "matchedMv",
          },
        },
        { $match: { matchedMv: { $size: 0 } } },
        { $project: { entryNo: 1, date: 1, inventoryMovement: 1 } },
        { $limit: 20 },
      ]),

      // ProductStock onHand sum vs InventoryValuation valuationQuantity discrepancy
      ProductStock.aggregate([
        { $match: { tenantId: tid, status: "active" } },
        {
          $group: {
            _id: { product: "$product", warehouse: "$warehouse" },
            onHandQty: { $sum: "$onHandQuantity" },
            stockVal: { $sum: "$inventoryValue" },
          },
        },
        {
          $lookup: {
            from: "inventoryvaluations",
            let: { p: "$_id.product", w: "$_id.warehouse" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [{ $eq: ["$product", "$$p"] }, { $eq: ["$warehouse", "$$w"] }],
                  },
                },
              },
            ],
            as: "val",
          },
        },
        { $unwind: { path: "$val", preserveNullAndEmptyArrays: true } },
        {
          $match: {
            $expr: {
              $ne: ["$onHandQty", { $ifNull: ["$val.valuationQuantity", 0] }],
            },
          },
        },
        { $limit: 20 },
      ]),
    ]);

  return {
    asOfDate: targetDate,
    inventoryControlAccount: {
      _id: inventoryAccount._id,
      code: inventoryAccount.code,
      name: inventoryAccount.name,
    },
    subledgerValue,
    glBalance,
    difference,
    isReconciled: Math.abs(difference) < 0.01,
    diagnostics: {
      unpostedMovementsCount: unpostedMovements.length,
      unpostedMovements,
      manualGlEntriesCount: manualGlEntries.length,
      manualGlEntries,
      orphanedJournalsCount: orphanedJournals.length,
      orphanedJournals,
      stockValuationDiscrepanciesCount: stockValuationDiscrepancies.length,
      stockValuationDiscrepancies,
    },
  };
};

/**
 * 8. Stock Aging Report into 6 configurable buckets.
 */
export const calculateStockAgingReport = async ({
  tenantId,
  warehouseId = null,
  categoryId = null,
  productId = null,
  asOfDate = new Date(),
}) => {
  const tid = oid(tenantId);
  const now = new Date(asOfDate);

  const match = { tenantId: tid, status: "open", remainingQuantity: { $gt: 0 } };
  if (warehouseId && isId(warehouseId)) match.warehouse = oid(warehouseId);
  if (productId && isId(productId)) match.product = oid(productId);

  // Read active FIFO layers
  const openLayers = await FifoCostLayer.find(match)
    .populate("product", "name sku category")
    .populate("warehouse", "name code")
    .lean();

  const grouped = new Map();

  openLayers.forEach((layer) => {
    const pid = String(layer.product?._id || layer.product);
    const wid = String(layer.warehouse?._id || layer.warehouse);
    const key = `${pid}:${wid}`;

    if (!grouped.has(key)) {
      grouped.set(key, {
        product: layer.product,
        warehouse: layer.warehouse,
        totalQuantity: 0,
        totalValue: 0,
        bucket0_30: { quantity: 0, value: 0 },
        bucket31_60: { quantity: 0, value: 0 },
        bucket61_90: { quantity: 0, value: 0 },
        bucket91_180: { quantity: 0, value: 0 },
        bucket181_365: { quantity: 0, value: 0 },
        bucket365Plus: { quantity: 0, value: 0 },
      });
    }

    const row = grouped.get(key);
    const qty = num(layer.remainingQuantity);
    const val = roundMoney(qty * num(layer.unitCost));
    const ageDays = Math.max(0, (now.getTime() - new Date(layer.receiptDate).getTime()) / 86400000);

    row.totalQuantity = roundQuantity(row.totalQuantity + qty);
    row.totalValue = roundMoney(row.totalValue + val);

    if (ageDays <= 30) {
      row.bucket0_30.quantity = roundQuantity(row.bucket0_30.quantity + qty);
      row.bucket0_30.value = roundMoney(row.bucket0_30.value + val);
    } else if (ageDays <= 60) {
      row.bucket31_60.quantity = roundQuantity(row.bucket31_60.quantity + qty);
      row.bucket31_60.value = roundMoney(row.bucket31_60.value + val);
    } else if (ageDays <= 90) {
      row.bucket61_90.quantity = roundQuantity(row.bucket61_90.quantity + qty);
      row.bucket61_90.value = roundMoney(row.bucket61_90.value + val);
    } else if (ageDays <= 180) {
      row.bucket91_180.quantity = roundQuantity(row.bucket91_180.quantity + qty);
      row.bucket91_180.value = roundMoney(row.bucket91_180.value + val);
    } else if (ageDays <= 365) {
      row.bucket181_365.quantity = roundQuantity(row.bucket181_365.quantity + qty);
      row.bucket181_365.value = roundMoney(row.bucket181_365.value + val);
    } else {
      row.bucket365Plus.quantity = roundQuantity(row.bucket365Plus.quantity + qty);
      row.bucket365Plus.value = roundMoney(row.bucket365Plus.value + val);
    }
  });

  const rows = Array.from(grouped.values());
  const summary = rows.reduce(
    (acc, r) => {
      acc.totalQuantity = roundQuantity(acc.totalQuantity + r.totalQuantity);
      acc.totalValue = roundMoney(acc.totalValue + r.totalValue);
      acc.b0_30 = roundMoney(acc.b0_30 + r.bucket0_30.value);
      acc.b31_60 = roundMoney(acc.b31_60 + r.bucket31_60.value);
      acc.b61_90 = roundMoney(acc.b61_90 + r.bucket61_90.value);
      acc.b91_180 = roundMoney(acc.b91_180 + r.bucket91_180.value);
      acc.b181_365 = roundMoney(acc.b181_365 + r.bucket181_365.value);
      acc.b365Plus = roundMoney(acc.b365Plus + r.bucket365Plus.value);
      return acc;
    },
    { totalQuantity: 0, totalValue: 0, b0_30: 0, b31_60: 0, b61_90: 0, b91_180: 0, b181_365: 0, b365Plus: 0 }
  );

  return {
    asOfDate: now,
    summary,
    count: rows.length,
    rows,
  };
};

/**
 * 9. Slow & Non-Moving Inventory Report.
 */
export const calculateSlowMovingReport = async ({
  tenantId,
  warehouseId = null,
  daysThreshold = 90,
  limit = 100,
  skip = 0,
}) => {
  const tid = oid(tenantId);
  const cutoff = new Date(Date.now() - daysThreshold * 86400000);

  const match = {
    tenantId: tid,
    status: "active",
    onHandQuantity: { $gt: 0 },
    $or: [
      { lastMovementAt: { $lt: cutoff } },
      { lastMovementAt: null },
    ],
  };
  if (warehouseId && isId(warehouseId)) match.warehouse = oid(warehouseId);

  const [stocks, total] = await Promise.all([
    ProductStock.find(match)
      .populate("product", "name sku category brand baseUnit")
      .populate("warehouse", "name code")
      .populate("location", "name code")
      .sort({ lastMovementAt: 1, inventoryValue: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    ProductStock.countDocuments(match),
  ]);

  const rows = stocks.map((s) => {
    const daysInactive = s.lastMovementAt
      ? Math.floor((Date.now() - new Date(s.lastMovementAt).getTime()) / 86400000)
      : 999;
    return {
      product: s.product,
      warehouse: s.warehouse,
      location: s.location,
      onHandQuantity: s.onHandQuantity,
      availableQuantity: s.availableQuantity,
      averageCost: s.averageCost,
      inventoryValue: s.inventoryValue,
      lastMovementAt: s.lastMovementAt,
      daysInactive,
      classification: daysInactive >= 180 ? "non_moving" : "slow_moving",
    };
  });

  return {
    daysThreshold,
    total,
    count: rows.length,
    rows,
  };
};

/**
 * 28. Data Consistency & Integrity Checks.
 */
export const runInventoryIntegrityDiagnostic = async ({ tenantId }) => {
  const tid = oid(tenantId);

  const [
    negativeReserved,
    availableMismatch,
    duplicateActiveSerials,
    valuationQuantityMismatches,
    missingJournals,
    stuckInTransit,
  ] = await Promise.all([
    // 1. Reserved < 0
    ProductStock.find({ tenantId: tid, reservedQuantity: { $lt: 0 } })
      .select("product warehouse location reservedQuantity onHandQuantity")
      .limit(20)
      .lean(),

    // 2. Available formula mismatch
    ProductStock.find({
      tenantId: tid,
      status: "active",
      $expr: {
        $ne: [
          "$availableQuantity",
          {
            $subtract: [
              { $subtract: ["$onHandQuantity", "$reservedQuantity"] },
              "$quarantineQuantity",
            ],
          },
        ],
      },
    })
      .select("product warehouse location onHandQuantity reservedQuantity quarantineQuantity availableQuantity")
      .limit(20)
      .lean(),

    // 3. Duplicate active serial numbers
    InventoryTracking.aggregate([
      { $match: { tenantId: tid, trackingType: "serial", status: "active" } },
      {
        $group: {
          _id: "$trackingReference",
          count: { $sum: 1 },
          locations: { $push: "$location" },
        },
      },
      { $match: { count: { $gt: 1 } } },
      { $limit: 20 },
    ]),

    // 4. Valuation quantity != sum of on-hand quantity across bins
    ProductStock.aggregate([
      { $match: { tenantId: tid, status: "active" } },
      {
        $group: {
          _id: { product: "$product", warehouse: "$warehouse" },
          totalOnHand: { $sum: "$onHandQuantity" },
        },
      },
      {
        $lookup: {
          from: "inventoryvaluations",
          let: { p: "$_id.product", w: "$_id.warehouse" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [{ $eq: ["$product", "$$p"] }, { $eq: ["$warehouse", "$$w"] }],
                },
              },
            },
          ],
          as: "valuation",
        },
      },
      { $unwind: { path: "$valuation", preserveNullAndEmptyArrays: true } },
      {
        $match: {
          $expr: {
            $ne: ["$totalOnHand", { $ifNull: ["$valuation.valuationQuantity", 0] }],
          },
        },
      },
      { $limit: 20 },
    ]),

    // 5. Posted movements missing journal entries
    StockMovement.find({
      tenantId: tid,
      status: "posted",
      totalValue: { $gt: 0 },
      journalEntry: null,
      accountingStatus: { $ne: "posted" },
    })
      .select("movementNo movementDate movementType totalQuantity totalValue")
      .limit(20)
      .lean(),

    // 6. Stuck in-transit transfer lines older than 30 days
    StockTransfer.find({
      tenantId: tid,
      status: { $in: ["dispatched", "partially_received"] },
      dispatchedAt: { $lt: new Date(Date.now() - 30 * 86400000) },
    })
      .select("transferNo status sourceWarehouse destinationWarehouse dispatchedAt")
      .limit(20)
      .lean(),
  ]);

  const totalIssues =
    negativeReserved.length +
    availableMismatch.length +
    duplicateActiveSerials.length +
    valuationQuantityMismatches.length +
    missingJournals.length +
    stuckInTransit.length;

  return {
    checkedAt: new Date(),
    isClean: totalIssues === 0,
    totalIssues,
    issues: {
      negativeReservedCount: negativeReserved.length,
      negativeReserved,
      availableMismatchCount: availableMismatch.length,
      availableMismatch,
      duplicateActiveSerialsCount: duplicateActiveSerials.length,
      duplicateActiveSerials,
      valuationQuantityMismatchesCount: valuationQuantityMismatches.length,
      valuationQuantityMismatches,
      missingJournalsCount: missingJournals.length,
      missingJournals,
      stuckInTransitCount: stuckInTransit.length,
      stuckInTransit,
    },
  };
};

/**
 * 29. Reconciliation & Repair Tools (Dry-Run Capable).
 */
export const executeInventoryRepairPlan = async ({
  tenantId,
  dryRun = true,
  userId = null,
  session = null,
}) => {
  const tid = oid(tenantId);
  const diagnostic = await runInventoryIntegrityDiagnostic({ tenantId: tid });

  const proposedFixes = [];

  // Plan 1: Fix available quantity formula mismatches
  for (const row of diagnostic.issues.availableMismatch) {
    const expected = roundQuantity(
      num(row.onHandQuantity) - num(row.reservedQuantity) - num(row.quarantineQuantity)
    );
    proposedFixes.push({
      type: "fix_available_quantity",
      targetId: row._id,
      model: "ProductStock",
      currentAvailable: row.availableQuantity,
      proposedAvailable: expected,
    });
  }

  // Plan 2: Synchronize valuationQuantity with sum of ProductStock onHand
  for (const row of diagnostic.issues.valuationQuantityMismatches) {
    proposedFixes.push({
      type: "sync_valuation_quantity",
      productId: row._id.product,
      warehouseId: row._id.warehouse,
      currentValuationQuantity: row.valuation?.valuationQuantity || 0,
      proposedValuationQuantity: row.totalOnHand,
    });
  }

  if (dryRun) {
    return {
      dryRun: true,
      diagnosticSummary: { isClean: diagnostic.isClean, totalIssues: diagnostic.totalIssues },
      proposedFixesCount: proposedFixes.length,
      proposedFixes,
    };
  }

  // Active execution: apply changes
  let appliedCount = 0;
  for (const fix of proposedFixes) {
    if (fix.type === "fix_available_quantity") {
      await ProductStock.updateOne(
        { _id: fix.targetId, tenantId: tid },
        { $set: { availableQuantity: fix.proposedAvailable } },
        session ? { session } : {}
      );
      appliedCount++;
    } else if (fix.type === "sync_valuation_quantity") {
      await InventoryValuation.updateOne(
        { tenantId: tid, product: fix.productId, warehouse: fix.warehouseId },
        { $set: { valuationQuantity: fix.proposedValuationQuantity } },
        session ? { session } : {}
      );
      appliedCount++;
    }
  }

  if (userId) {
    await writeAudit({
      session,
      tenantId: tid,
      actorId: userId,
      action: "update",
      entityType: "InventoryValuation",
      entityId: tid,
      meta: { appliedFixesCount: appliedCount, dryRun: false },
    });
  }

  return {
    dryRun: false,
    appliedFixesCount: appliedCount,
    proposedFixes,
  };
};
