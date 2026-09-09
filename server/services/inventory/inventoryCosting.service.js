import mongoose from "mongoose";
import InventoryValuation, {
  roundMoney,
  roundQuantity,
} from "../../models/inventory/inventoryValuation.model.js";
import FifoCostLayer from "../../models/inventory/fifoCostLayer.model.js";
import Product from "../../models/inventory/product.model.js";
import StockMovement from "../../models/inventory/stockMovement.model.js";

/**
 * Ensures costing method cannot be modified if posted stock movements exist.
 */
export const assertCostingMethodCanBeChanged = async (
  tenantId,
  productId,
  session = null
) => {
  const query = StockMovement.exists({
    tenantId,
    products: productId,
    status: "posted",
  });
  if (session) query.session(session);
  const exists = await query;
  if (exists) {
    throw Object.assign(
      new Error(
        "Costing method cannot be changed once inventory movements have been posted for this product."
      ),
      { statusCode: 409 }
    );
  }
};

/**
 * Gets or creates the financial InventoryValuation document for { tenantId, product, warehouse }.
 */
export const getOrCreateValuation = async ({
  tenantId,
  productId,
  warehouseId,
  session = null,
}) => {
  const query = InventoryValuation.findOne({
    tenantId,
    product: productId,
    warehouse: warehouseId,
  });
  if (session) query.session(session);
  let valuation = await query;

  if (!valuation) {
    const productQuery = Product.findOne({ _id: productId, tenantId }).select(
      "costingMethod standardCost purchasePrice"
    );
    if (session) productQuery.session(session);
    const product = await productQuery.lean();

    const costingMethod = product?.costingMethod || "weighted_average";
    const standardCost = roundMoney(product?.standardCost || 0);
    const initialCost = roundMoney(
      standardCost || product?.purchasePrice || 0
    );

    try {
      const created = await InventoryValuation.create(
        [
          {
            tenantId,
            product: productId,
            warehouse: warehouseId,
            costingMethod,
            standardCost,
            averageCost: initialCost,
            inventoryValue: 0,
            valuationQuantity: 0,
            valuationVersion: 0,
          },
        ],
        session ? { session } : undefined
      );
      valuation = created[0];
    } catch (error) {
      if (error?.code === 11000) {
        const retryQuery = InventoryValuation.findOne({
          tenantId,
          product: productId,
          warehouse: warehouseId,
        });
        if (session) retryQuery.session(session);
        valuation = await retryQuery;
      } else {
        throw error;
      }
    }
  }

  return valuation;
};

/**
 * Processes an inbound stock movement line (receipt) and computes applied cost, valuation update,
 * and any variances (such as PPV for standard costing or negative stock variance).
 */
export const processInboundLineCost = async ({
  tenantId,
  productId,
  warehouseId,
  quantity,
  receiptUnitCost,
  sourceMovementId = null,
  sourceType = "goods_receipt",
  sourceDocument = "",
  userId = null,
  session = null,
}) => {
  const qty = roundQuantity(quantity);
  const rawCost = roundMoney(receiptUnitCost);
  const valuation = await getOrCreateValuation({
    tenantId,
    productId,
    warehouseId,
    session,
  });

  const method = valuation.costingMethod || "weighted_average";
  let appliedUnitCost = rawCost;
  let appliedValue = roundMoney(qty * rawCost);
  let varianceAmount = 0; // Variance to be booked (e.g. PPV)
  let negativeStockVariance = 0;

  if (method === "standard") {
    const productQuery = Product.findById(productId).select("standardCost");
    if (session) productQuery.session(session);
    const product = await productQuery.lean();

    const stdCost = roundMoney(product?.standardCost || valuation.standardCost || 0);
    appliedUnitCost = stdCost;
    appliedValue = roundMoney(qty * stdCost);
    // PPV = (Actual - Standard) * Quantity
    varianceAmount = roundMoney(qty * (rawCost - stdCost));

    valuation.valuationQuantity = roundQuantity(valuation.valuationQuantity + qty);
    valuation.inventoryValue = roundMoney(valuation.inventoryValue + appliedValue);
    valuation.standardCost = stdCost;
    valuation.averageCost = stdCost;
    valuation.valuationVersion = (valuation.valuationVersion || 0) + 1;
    valuation.lastValuationAt = new Date();
    valuation.lastMovement = sourceMovementId;
    valuation.updatedBy = userId;
    await valuation.save({ session });
  } else if (method === "fifo") {
    // Create FIFO layer
    await FifoCostLayer.create(
      [
        {
          tenantId,
          product: productId,
          warehouse: warehouseId,
          receiptDate: new Date(),
          sourceMovement: sourceMovementId,
          sourceType,
          sourceDocument,
          originalQuantity: qty,
          remainingQuantity: qty,
          unitCost: rawCost,
          totalCost: appliedValue,
          status: "open",
        },
      ],
      session ? { session } : undefined
    );

    // Check if replenishment of provisional negative stock
    if (valuation.provisionalNegativeQuantity > 0) {
      const clearingQty = Math.min(valuation.provisionalNegativeQuantity, qty);
      const provCost = valuation.provisionalNegativeCost || valuation.averageCost || rawCost;
      negativeStockVariance = roundMoney(clearingQty * (rawCost - provCost));
      valuation.provisionalNegativeQuantity = roundQuantity(
        valuation.provisionalNegativeQuantity - clearingQty
      );
      if (valuation.provisionalNegativeQuantity === 0) {
        valuation.provisionalNegativeCost = 0;
      }
    }

    valuation.valuationQuantity = roundQuantity(valuation.valuationQuantity + qty);
    valuation.inventoryValue = roundMoney(valuation.inventoryValue + appliedValue);
    if (valuation.valuationQuantity > 0) {
      valuation.averageCost = roundMoney(
        valuation.inventoryValue / valuation.valuationQuantity
      );
    }
    valuation.valuationVersion = (valuation.valuationVersion || 0) + 1;
    valuation.lastValuationAt = new Date();
    valuation.lastMovement = sourceMovementId;
    valuation.updatedBy = userId;
    await valuation.save({ session });
  } else {
    // Weighted Average
    const prevQty = valuation.valuationQuantity || 0;
    const prevValue = valuation.inventoryValue || 0;

    // If replenishing negative stock
    if (prevQty < 0) {
      const negativeQty = Math.abs(prevQty);
      const clearingQty = Math.min(negativeQty, qty);
      const provCost = valuation.averageCost || rawCost;
      negativeStockVariance = roundMoney(clearingQty * (rawCost - provCost));

      const newQty = roundQuantity(prevQty + qty);
      if (newQty <= 0) {
        valuation.valuationQuantity = newQty;
        valuation.inventoryValue = roundMoney(newQty * provCost);
      } else {
        valuation.valuationQuantity = newQty;
        valuation.averageCost = rawCost;
        valuation.inventoryValue = roundMoney(newQty * rawCost);
      }
    } else if (prevQty === 0) {
      valuation.valuationQuantity = qty;
      valuation.averageCost = rawCost;
      valuation.inventoryValue = appliedValue;
    } else {
      const newQty = roundQuantity(prevQty + qty);
      const newValue = roundMoney(prevValue + appliedValue);
      valuation.valuationQuantity = newQty;
      valuation.inventoryValue = newValue;
      valuation.averageCost = roundMoney(newValue / newQty);
    }

    valuation.valuationVersion = (valuation.valuationVersion || 0) + 1;
    valuation.lastValuationAt = new Date();
    valuation.lastMovement = sourceMovementId;
    valuation.updatedBy = userId;
    await valuation.save({ session });
  }

  return {
    costingMethod: method,
    appliedUnitCost,
    appliedValue,
    varianceAmount,
    negativeStockVariance,
    valuationVersion: valuation.valuationVersion,
  };
};

/**
 * Processes an outbound stock movement line (issue / delivery) and computes applied cost,
 * consuming FIFO layers or relieving moving average stock.
 */
export const processOutboundLineCost = async ({
  tenantId,
  productId,
  warehouseId,
  quantity,
  sourceMovementId = null,
  userId = null,
  session = null,
}) => {
  const qty = roundQuantity(quantity);
  const valuation = await getOrCreateValuation({
    tenantId,
    productId,
    warehouseId,
    session,
  });

  const method = valuation.costingMethod || "weighted_average";
  let appliedUnitCost = 0;
  let appliedValue = 0;
  const consumedLayers = [];

  if (method === "standard") {
    const productQuery = Product.findById(productId).select("standardCost purchasePrice");
    if (session) productQuery.session(session);
    const product = await productQuery.lean();

    appliedUnitCost = roundMoney(product?.standardCost || valuation.standardCost || valuation.averageCost || 0);
    appliedValue = roundMoney(qty * appliedUnitCost);

    valuation.valuationQuantity = roundQuantity(valuation.valuationQuantity - qty);
    valuation.inventoryValue = roundMoney(valuation.inventoryValue - appliedValue);
    valuation.valuationVersion = (valuation.valuationVersion || 0) + 1;
    valuation.lastValuationAt = new Date();
    valuation.lastMovement = sourceMovementId;
    valuation.updatedBy = userId;
    await valuation.save({ session });
  } else if (method === "fifo") {
    const layerQuery = FifoCostLayer.find({
      tenantId,
      product: productId,
      warehouse: warehouseId,
      status: "open",
      remainingQuantity: { $gt: 0 },
    }).sort({ receiptDate: 1, _id: 1 });
    if (session) layerQuery.session(session);
    const openLayers = await layerQuery;

    let remainingNeeded = qty;
    let totalLayerValue = 0;

    for (const layer of openLayers) {
      if (remainingNeeded <= 0) break;
      const consumeQty = Math.min(layer.remainingQuantity, remainingNeeded);
      const layerCost = roundMoney(consumeQty * layer.unitCost);

      layer.remainingQuantity = roundQuantity(layer.remainingQuantity - consumeQty);
      if (layer.remainingQuantity <= 0) {
        layer.status = "exhausted";
        layer.remainingQuantity = 0;
      }
      await layer.save({ session });

      consumedLayers.push({
        layerId: layer._id,
        quantity: consumeQty,
        unitCost: layer.unitCost,
        totalCost: layerCost,
      });

      totalLayerValue = roundMoney(totalLayerValue + layerCost);
      remainingNeeded = roundQuantity(remainingNeeded - consumeQty);
    }

    // If remaining needed > 0 (negative stock occurred)
    if (remainingNeeded > 0) {
      const fallbackCost = valuation.averageCost || openLayers[openLayers.length - 1]?.unitCost || 0;
      const provCost = roundMoney(remainingNeeded * fallbackCost);
      totalLayerValue = roundMoney(totalLayerValue + provCost);
      valuation.provisionalNegativeQuantity = roundQuantity(
        (valuation.provisionalNegativeQuantity || 0) + remainingNeeded
      );
      valuation.provisionalNegativeCost = fallbackCost;
    }

    appliedValue = totalLayerValue;
    appliedUnitCost = roundMoney(appliedValue / qty);

    valuation.valuationQuantity = roundQuantity(valuation.valuationQuantity - qty);
    valuation.inventoryValue = roundMoney(
      Math.max(0, valuation.inventoryValue - appliedValue)
    );
    if (valuation.valuationQuantity > 0) {
      valuation.averageCost = roundMoney(
        valuation.inventoryValue / valuation.valuationQuantity
      );
    }
    valuation.valuationVersion = (valuation.valuationVersion || 0) + 1;
    valuation.lastValuationAt = new Date();
    valuation.lastMovement = sourceMovementId;
    valuation.updatedBy = userId;
    await valuation.save({ session });
  } else {
    // Weighted average issue
    appliedUnitCost = roundMoney(valuation.averageCost || 0);

    // If averageCost is 0, fallback to product purchasePrice or standardCost
    if (appliedUnitCost === 0) {
      const productQuery = Product.findById(productId).select("purchasePrice standardCost");
      if (session) productQuery.session(session);
      const product = await productQuery.lean();
      appliedUnitCost = roundMoney(product?.purchasePrice || product?.standardCost || 0);
      valuation.averageCost = appliedUnitCost;
    }

    appliedValue = roundMoney(qty * appliedUnitCost);
    const newQty = roundQuantity(valuation.valuationQuantity - qty);

    valuation.valuationQuantity = newQty;
    if (newQty <= 0) {
      valuation.inventoryValue = roundMoney(newQty * appliedUnitCost);
    } else {
      valuation.inventoryValue = roundMoney(valuation.inventoryValue - appliedValue);
    }

    valuation.valuationVersion = (valuation.valuationVersion || 0) + 1;
    valuation.lastValuationAt = new Date();
    valuation.lastMovement = sourceMovementId;
    valuation.updatedBy = userId;
    await valuation.save({ session });
  }

  return {
    costingMethod: method,
    appliedUnitCost,
    appliedValue,
    consumedLayers,
    valuationVersion: valuation.valuationVersion,
  };
};
