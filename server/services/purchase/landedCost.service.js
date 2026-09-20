import GoodsReceipt from "../../models/goodsReceipt.model.js";
import InventoryValuation from "../../models/inventory/inventoryValuation.model.js";
import FifoCostLayer from "../../models/inventory/fifoCostLayer.model.js";

const money = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
const preciseMoney = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 10000) / 10000;
const qty = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 1_000_000) / 1_000_000;
const withSession = (query, session) => (session ? query.session(session) : query);
const saveOptions = (session) => (session ? { session } : undefined);

export const buildLandedCostAllocations = async ({ landedCost, session = null }) => {
  const receiptIds = [...new Set((landedCost.goodsReceipts || []).map(String))];
  if (!receiptIds.length) {
    throw Object.assign(new Error("At least one posted goods receipt is required for landed-cost allocation."), { statusCode: 400 });
  }
  const receipts = await withSession(
    GoodsReceipt.find({ _id: { $in: receiptIds }, status: "posted" }).select(
      "_id purchaseOrder commercialLC importShipment warehouse movement lines"
    ),
    session
  ).lean();
  if (receipts.length !== receiptIds.length) {
    throw Object.assign(new Error("One or more selected goods receipts are missing or not posted."), { statusCode: 409 });
  }
  for (const receipt of receipts) {
    if (String(receipt.purchaseOrder) !== String(landedCost.purchaseOrder)) {
      throw Object.assign(new Error("Every goods receipt must belong to the landed-cost purchase order."), { statusCode: 409 });
    }
    if (receipt.commercialLC && String(receipt.commercialLC) !== String(landedCost.commercialLC)) {
      throw Object.assign(new Error("Every goods receipt must belong to the selected Commercial LC."), { statusCode: 409 });
    }
  }

  const rows = [];
  for (const receipt of receipts) {
    for (const line of receipt.lines || []) {
      const eligibleQuantity = qty(
        Number(line.acceptedQuantity || 0) +
          Number(line.quarantineQuantity || 0) -
          Number(line.returnedQuantity || 0)
      );
      if (!line.product || eligibleQuantity <= 0) continue;
      rows.push({
        goodsReceipt: receipt._id,
        goodsReceiptLine: line._id,
        product: line.product,
        warehouse: receipt.warehouse,
        movement: receipt.movement,
        receivedQuantity: eligibleQuantity,
        baseValue: money(eligibleQuantity * Number(line.unitCost || 0)),
      });
    }
  }
  if (!rows.length) {
    throw Object.assign(new Error("Selected goods receipts have no accepted inventory available for landed-cost allocation."), { statusCode: 409 });
  }

  const totalCost = money(landedCost.totalLandedCost);
  if (totalCost <= 0) {
    throw Object.assign(new Error("Landed cost must be greater than zero."), { statusCode: 400 });
  }

  if (landedCost.allocationBasis === "manual") {
    const manual = new Map((landedCost.allocations || []).map((item) => [`${item.goodsReceipt}:${item.goodsReceiptLine}`, Number(item.allocatedCost || 0)]));
    let total = 0;
    const allocations = rows.map((row) => {
      const allocatedCost = money(manual.get(`${row.goodsReceipt}:${row.goodsReceiptLine}`) || 0);
      total = money(total + allocatedCost);
      return { ...row, allocationWeight: 0, allocatedCost, landedUnitCostIncrease: row.receivedQuantity ? preciseMoney(allocatedCost / row.receivedQuantity) : 0 };
    });
    if (Math.abs(total - totalCost) > 0.01) {
      throw Object.assign(new Error("Manual landed-cost allocations must equal the total landed cost."), { statusCode: 400 });
    }
    return allocations;
  }

  const weightField = landedCost.allocationBasis === "quantity" ? "receivedQuantity" : "baseValue";
  const totalWeight = rows.reduce((sum, row) => sum + Number(row[weightField] || 0), 0);
  if (totalWeight <= 0) {
    throw Object.assign(new Error(`Cannot allocate landed cost by ${landedCost.allocationBasis}; allocation weight is zero.`), { statusCode: 409 });
  }

  let allocatedRunning = 0;
  return rows.map((row, index) => {
    const allocatedCost = index === rows.length - 1
      ? money(totalCost - allocatedRunning)
      : money(totalCost * (Number(row[weightField] || 0) / totalWeight));
    allocatedRunning = money(allocatedRunning + allocatedCost);
    return {
      ...row,
      allocationWeight: Number(row[weightField] || 0),
      allocatedCost,
      landedUnitCostIncrease: row.receivedQuantity ? preciseMoney(allocatedCost / row.receivedQuantity) : 0,
    };
  });
};

const applyFifoAllocation = async ({ allocation, direction, tenantId, session }) => {
  const layers = await withSession(
    FifoCostLayer.find({
      ...(tenantId ? { tenantId } : {}),
      product: allocation.product,
      warehouse: allocation.warehouse,
      sourceMovement: allocation.movement,
      sourceType: "goods_receipt",
      status: "open",
      remainingQuantity: { $gt: 0 },
    }).sort({ receiptDate: 1, _id: 1 }),
    session
  );
  const remaining = qty(layers.reduce((sum, layer) => sum + Number(layer.remainingQuantity || 0), 0));
  if (direction > 0 && remaining + 0.000001 < allocation.receivedQuantity) {
    throw Object.assign(
      new Error("FIFO stock from an import receipt has already been consumed. Finalize landed cost before consuming that receipt."),
      { statusCode: 409 }
    );
  }
  if (!layers.length) return;
  const perUnit = Number(allocation.landedUnitCostIncrease || 0) * direction;
  for (const layer of layers) {
    layer.unitCost = preciseMoney(Math.max(Number(layer.unitCost || 0) + perUnit, 0));
    layer.totalCost = preciseMoney(Number(layer.originalQuantity || 0) * layer.unitCost);
    await layer.save(saveOptions(session));
  }
};

export const applyLandedCostToInventory = async ({ landedCost, direction = 1, userId = null, session = null }) => {
  const movementByReceipt = new Map();
  const receipts = await withSession(
    GoodsReceipt.find({ _id: { $in: landedCost.goodsReceipts || [] } }).select("_id movement"),
    session
  ).lean();
  for (const receipt of receipts) movementByReceipt.set(String(receipt._id), receipt.movement || null);

  for (const item of landedCost.allocations || []) {
    const allocation = {
      goodsReceipt: item.goodsReceipt,
      goodsReceiptLine: item.goodsReceiptLine,
      product: item.product,
      warehouse: item.warehouse,
      receivedQuantity: Number(item.receivedQuantity || 0),
      allocatedCost: Number(item.allocatedCost || 0),
      landedUnitCostIncrease: Number(item.landedUnitCostIncrease || 0),
      movement: movementByReceipt.get(String(item.goodsReceipt)) || null,
    };
    const valuation = await withSession(
      InventoryValuation.findOne({
        ...(landedCost.tenantId ? { tenantId: landedCost.tenantId } : {}),
        product: allocation.product,
        warehouse: allocation.warehouse,
      }),
      session
    );
    if (!valuation || Number(valuation.valuationQuantity || 0) <= 0) {
      throw Object.assign(new Error("Inventory valuation is unavailable for one or more landed-cost allocation lines."), { statusCode: 409 });
    }

    const adjustment = preciseMoney(Number(allocation.allocatedCost || 0) * direction);
    const nextValue = preciseMoney(Number(valuation.inventoryValue || 0) + adjustment);
    if (nextValue < -0.009) {
      throw Object.assign(new Error("Landed-cost reversal would make inventory value negative."), { statusCode: 409 });
    }
    valuation.inventoryValue = Math.max(nextValue, 0);
    valuation.averageCost = valuation.valuationQuantity > 0
      ? preciseMoney(valuation.inventoryValue / valuation.valuationQuantity)
      : 0;
    valuation.valuationVersion = Number(valuation.valuationVersion || 0) + 1;
    valuation.lastValuationAt = new Date();
    valuation.updatedBy = userId;

    if (valuation.costingMethod === "fifo") {
      await applyFifoAllocation({ allocation, direction, tenantId: landedCost.tenantId || null, session });
    }
    await valuation.save(saveOptions(session));
  }
};
