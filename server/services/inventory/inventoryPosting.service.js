import mongoose from "mongoose";
import ProductStock, { roundMoney, roundQuantity } from "../../models/inventory/productStock.model.js";
import StockMovement from "../../models/inventory/stockMovement.model.js";
import Product from "../../models/inventory/product.model.js";
import Warehouse from "../../models/inventory/warehouse.model.js";
import WarehouseLocation from "../../models/inventory/warehouseLocation.model.js";
import { InventoryLoss } from "../../models/inventory/inventoryOperations.model.js";
import { convertUnitQuantity } from "../../services/uomConversion.service.js";
import { runMongoTransaction } from "../../utils/mongoTransaction.js";

const clean = (value) => String(value ?? "").trim();
const isId = (value) => mongoose.Types.ObjectId.isValid(String(value || ""));
const idString = (value) => String(value?._id || value || "");

export const requireTenant = (tenantId) => {
  if (!isId(tenantId)) {
    throw Object.assign(new Error("Tenant context is required for inventory operations."), {
      statusCode: 400,
    });
  }
  return new mongoose.Types.ObjectId(String(tenantId));
};

const executeInSession = async (existingSession, work) => {
  if (existingSession) return work(existingSession);
  return runMongoTransaction(async (session) => work(session));
};

/**
 * Central posting function for any generic StockMovement document.
 */
export const postStockMovement = async ({
  tenantId,
  movementId = null,
  movementDate = null,
  movementType,
  reference,
  sourceType = "manual",
  sourceId = null,
  idempotencyKey = "",
  currency = "BDT",
  reason = "",
  notes = "",
  lines = [],
  userId = null,
  session = null,
}) => {
  const tid = requireTenant(tenantId);
  return executeInSession(session, async (s) => {
    if (movementId) {
      const existing = await StockMovement.findOne({ _id: movementId, tenantId: tid }).session(s);
      if (!existing) {
        throw Object.assign(new Error("Stock movement was not found in this tenant context."), { statusCode: 404 });
      }
      return StockMovement.postMovementDocument({ movementId: existing._id, userId, session: s });
    }

    const key = clean(idempotencyKey);
    if (key) {
      const existing = await StockMovement.findOne({ tenantId: tid, idempotencyKey: key }).session(s);
      if (existing) {
        if (existing.status === "draft") {
          return StockMovement.postMovementDocument({ movementId: existing._id, userId, session: s });
        }
        return existing;
      }
    }

    await StockMovement.validateDraftLines(lines, { tenantId: tid, session: s });

    const movement = new StockMovement({
      tenantId: tid,
      movementType,
      status: "draft",
      reference: clean(reference).toUpperCase(),
      sourceType: clean(sourceType).toLowerCase(),
      sourceId: isId(sourceId) ? new mongoose.Types.ObjectId(String(sourceId)) : null,
      idempotencyKey: key || undefined,
      currency: clean(currency || "BDT").toUpperCase(),
      reason: clean(reason),
      notes: clean(notes),
      lines,
      createdBy: userId,
      updatedBy: userId,
    });
    await movement.save({ session: s });
    return StockMovement.postMovementDocument({ movementId: movement._id, userId, session: s });
  });
};

/**
 * Reverse an existing posted stock movement.
 */
export const reverseStockMovement = async ({
  tenantId,
  movementId,
  reason = "",
  userId = null,
  session = null,
}) => {
  const tid = requireTenant(tenantId);
  return executeInSession(session, async (s) => {
    const original = await StockMovement.findOne({ _id: movementId, tenantId: tid }).session(s);
    if (!original) {
      throw Object.assign(new Error("Stock movement was not found in this tenant context."), {
        statusCode: 404,
      });
    }
    return StockMovement.reverseMovementDocument({
      movementId: original._id,
      userId,
      reason,
      session: s,
    });
  });
};

/**
 * Reserve stock for sales orders.
 */
export const reserveStock = async ({
  tenantId,
  salesOrderId,
  referenceNumber,
  lines = [],
  warehouseId,
  userId = null,
  session = null,
}) => {
  const tid = requireTenant(tenantId);
  return executeInSession(session, async (s) => {
    const idempotencyKey = `sales:reserve:${salesOrderId}`;
    const existing = await StockMovement.findOne({ tenantId: tid, idempotencyKey }).session(s);
    if (existing) {
      return { status: "reserved", reservationId: existing._id, stockMovementId: existing._id };
    }

    const movementLines = [];
    for (const line of lines) {
      const sourceWarehouse = line.warehouseId || warehouseId;
      let quantity = roundQuantity(line.quantity);

      if (line.uomId) {
        const converted = await convertUnitQuantity({
          tenantId: tid,
          product: line.productId,
          fromUnit: line.uomId,
          quantity,
          session: s,
        });
        quantity = converted.quantity;
      }

      movementLines.push({
        product: line.productId,
        effect: "reserve",
        sourceWarehouse,
        quantity,
        note: `Sales order line ${line.orderLineId || ""}`,
      });
    }

    const movement = await postStockMovement({
      tenantId: tid,
      movementType: "reservation",
      reference: referenceNumber,
      sourceType: "sales_order_reservation",
      sourceId: salesOrderId,
      idempotencyKey,
      reason: `Stock reserved for sales order ${referenceNumber}`,
      lines: movementLines,
      userId,
      session: s,
    });

    return { status: "reserved", reservationId: movement._id, stockMovementId: movement._id };
  });
};

/**
 * Release a sales order reservation.
 */
export const releaseStockReservation = async ({
  tenantId,
  salesOrderId,
  reservationId,
  userId = null,
  session = null,
}) => {
  const tid = requireTenant(tenantId);
  if (!isId(reservationId)) return { status: "released", reversalMovementId: null };
  return executeInSession(session, async (s) => {
    const reservation = await StockMovement.findOne({ _id: reservationId, tenantId: tid }).session(s);
    if (!reservation) return { status: "released", reversalMovementId: null };
    if (reservation.status === "reversed") {
      return { status: "released", reversalMovementId: reservation.reversedBy || null };
    }
    const reversal = await StockMovement.reverseMovementDocument({
      movementId: reservation._id,
      userId,
      reason: `Sales order reservation released for ${salesOrderId}`,
      session: s,
    });
    return { status: "released", reversalMovementId: reversal._id };
  });
};

export const calculateSafeReservationRelease = (currentReserved, deliveryQuantity) => {
  const reserved = Math.max(0, Number(currentReserved || 0));
  const requested = Math.max(0, Number(deliveryQuantity || 0));
  return roundQuantity(Math.min(reserved, requested));
};

/**
 * Safe sales delivery dispatch.
 * Prevents 409 conflict when delivering unreserved orders:
 * Checks ProductStock.reservedQuantity and only releases up to what is actually reserved.
 */
export const issueSalesDeliveryStock = async ({
  tenantId,
  deliveryNoteId,
  salesOrderId,
  referenceNumber,
  lines = [],
  warehouseId,
  userId = null,
  session = null,
}) => {
  const tid = requireTenant(tenantId);
  return executeInSession(session, async (s) => {
    const idempotencyKey = `sales:issue:${deliveryNoteId}`;
    const existing = await StockMovement.findOne({ tenantId: tid, idempotencyKey }).session(s);
    if (existing) {
      return { status: "posted", stockMovementId: existing._id, totalValue: existing.totalValue };
    }

    const movementLines = [];
    for (const line of lines) {
      let quantity = roundQuantity(line.quantity);
      if (line.uomId) {
        const converted = await convertUnitQuantity({
          tenantId: tid,
          product: line.productId,
          fromUnit: line.uomId,
          quantity,
          session: s,
        });
        quantity = converted.quantity;
      }

      // Check available reserved quantity on the stock position
      const stock = await ProductStock.findOne({
        tenantId: tid,
        product: line.productId,
        warehouse: warehouseId,
      }).session(s);

      const releaseQuantity = calculateSafeReservationRelease(stock?.reservedQuantity, quantity);

      // Only emit release line if there is actually reserved quantity to release
      if (releaseQuantity > 0) {
        movementLines.push({
          product: line.productId,
          effect: "release",
          sourceWarehouse: warehouseId,
          quantity: releaseQuantity,
          note: `Release reservation for sales order line ${line.orderLineId || ""}`,
        });
      }

      // Always emit the physical outbound movement
      movementLines.push({
        product: line.productId,
        effect: "out",
        sourceWarehouse: warehouseId,
        quantity,
        lotNumber: clean(line.lotNumber || line.batchId).toUpperCase(),
        serialNumbers: Array.isArray(line.serialNumbers) ? line.serialNumbers : [],
        note: `Delivery line for sales order ${salesOrderId || ""}`,
      });
    }

    const movement = await postStockMovement({
      tenantId: tid,
      movementType: "sales_issue",
      reference: referenceNumber,
      sourceType: "sales_delivery",
      sourceId: deliveryNoteId,
      idempotencyKey,
      reason: `Goods dispatched for delivery ${referenceNumber}`,
      lines: movementLines,
      userId,
      session: s,
    });

    return { status: "posted", stockMovementId: movement._id, totalValue: movement.totalValue };
  });
};

/**
 * Receive restocked customer returns.
 */
export const receiveSalesReturnStock = async ({
  tenantId,
  returnId,
  returnNumber,
  lines = [],
  warehouseId,
  reason = "",
  userId = null,
  session = null,
}) => {
  const tid = requireTenant(tenantId);
  const restockLines = (lines || []).filter((l) => l.restock);
  if (!restockLines.length) {
    return { status: "not_required", stockMovementId: null, totalValue: 0 };
  }

  return executeInSession(session, async (s) => {
    const idempotencyKey = `sales:return:${returnId}`;
    const existing = await StockMovement.findOne({ tenantId: tid, idempotencyKey }).session(s);
    if (existing) {
      return { status: "posted", stockMovementId: existing._id, totalValue: existing.totalValue };
    }

    const movementLines = [];
    for (const line of restockLines) {
      let quantity = roundQuantity(line.quantity);
      let unitCost = roundMoney(line.unitCost);

      if (line.uomId) {
        const converted = await convertUnitQuantity({
          tenantId: tid,
          product: line.productId,
          fromUnit: line.uomId,
          quantity,
          unitCost,
          session: s,
        });
        quantity = converted.quantity;
        unitCost = converted.unitCost;
      }

      movementLines.push({
        product: line.productId,
        effect: "in",
        destinationWarehouse: warehouseId,
        quantity,
        requestedUnitCost: unitCost,
        note: `Customer return ${returnNumber}: ${line.reason || ""}`,
      });
    }

    const movement = await postStockMovement({
      tenantId: tid,
      movementType: "sales_return",
      reference: returnNumber,
      sourceType: "sales_return",
      sourceId: returnId,
      idempotencyKey,
      reason: reason || `Customer return ${returnNumber}`,
      lines: movementLines,
      userId,
      session: s,
    });

    return { status: "posted", stockMovementId: movement._id, totalValue: movement.totalValue };
  });
};

/**
 * Post Goods Receipt stock movements with UoM conversion support.
 */
export const postGoodsReceiptStock = async ({
  tenantId,
  goodsReceipt,
  userId = null,
  session = null,
}) => {
  const tid = requireTenant(tenantId || goodsReceipt.tenantId);
  return executeInSession(session, async (s) => {
    const movementKey = `GRN:${goodsReceipt._id}:POST`;
    const existing = await StockMovement.findOne({ tenantId: tid, idempotencyKey: movementKey }).session(s);
    if (existing) return existing;

    const stockLines = [];
    for (const line of goodsReceipt.lines || []) {
      const acceptedQty = roundQuantity(line.acceptedQuantity);
      const quarantineQty = roundQuantity(line.quarantineQuantity);
      if (acceptedQty <= 0 && quarantineQty <= 0) continue;

      let convertedAccepted = acceptedQty;
      let convertedQuarantine = quarantineQty;
      let convertedUnitCost = roundMoney(line.unitCost);

      if (line.purchaseUnit) {
        if (acceptedQty > 0) {
          const conv = await convertUnitQuantity({
            tenantId: tid,
            product: line.product,
            fromUnit: line.purchaseUnit,
            quantity: acceptedQty,
            unitCost: convertedUnitCost,
            session: s,
          });
          convertedAccepted = conv.quantity;
          convertedUnitCost = conv.unitCost;
        }
        if (quarantineQty > 0) {
          const conv = await convertUnitQuantity({
            tenantId: tid,
            product: line.product,
            fromUnit: line.purchaseUnit,
            quantity: quarantineQty,
            unitCost: convertedUnitCost,
            session: s,
          });
          convertedQuarantine = conv.quantity;
          convertedUnitCost = conv.unitCost;
        }
      }

      const common = {
        product: line.product,
        requestedUnitCost: convertedUnitCost,
        lotNumber: clean(line.lotNumber).toUpperCase(),
        serialNumbers: Array.isArray(line.serialNumbers) ? line.serialNumbers : [],
        manufactureDate: line.manufactureDate || null,
        expiryDate: line.expiryDate || null,
        note: `Goods receipt ${goodsReceipt.receiptNo}`,
      };

      if (convertedAccepted > 0) {
        stockLines.push({
          ...common,
          effect: "in",
          destinationWarehouse: goodsReceipt.warehouse,
          destinationLocation: line.acceptedLocation || null,
          quantity: convertedAccepted,
        });
      }

      if (convertedQuarantine > 0) {
        stockLines.push({
          ...common,
          effect: "in_quarantine",
          destinationWarehouse: goodsReceipt.warehouse,
          destinationLocation: line.quarantineLocation || null,
          quantity: convertedQuarantine,
        });
      }
    }

    if (!stockLines.length) return null;

    return postStockMovement({
      tenantId: tid,
      movementType: "purchase_receipt",
      reference: goodsReceipt.receiptNo,
      sourceType: "goods_receipt",
      sourceId: goodsReceipt._id,
      idempotencyKey: movementKey,
      currency: goodsReceipt.currency,
      reason: `Purchase receipt ${goodsReceipt.receiptNo}`,
      notes: `System-generated stock movement for ${goodsReceipt.receiptNo}.`,
      lines: stockLines,
      userId,
      session: s,
    });
  });
};

/**
 * Reverse Goods Receipt stock movement.
 */
export const reverseGoodsReceiptStock = async ({
  tenantId,
  goodsReceipt,
  reason = "",
  userId = null,
  session = null,
}) => {
  const tid = requireTenant(tenantId || goodsReceipt.tenantId);
  if (!goodsReceipt.movement) return null;
  return reverseStockMovement({
    tenantId: tid,
    movementId: goodsReceipt.movement,
    reason,
    userId,
    session,
  });
};

/**
 * Post Purchase Return stock movements with UoM conversion support.
 */
export const postPurchaseReturnStock = async ({
  tenantId,
  purchaseReturn,
  userId = null,
  session = null,
}) => {
  const tid = requireTenant(tenantId || purchaseReturn.tenantId);
  return executeInSession(session, async (s) => {
    const movementKey = `PRN:${purchaseReturn._id}:POST`;
    const existing = await StockMovement.findOne({ tenantId: tid, idempotencyKey: movementKey }).session(s);
    if (existing) return existing;

    const movementLines = [];
    for (const line of purchaseReturn.lines || []) {
      let quantity = roundQuantity(line.returnQuantity);
      let unitCost = roundMoney(line.unitCost);

      if (line.purchaseUnit) {
        const conv = await convertUnitQuantity({
          tenantId: tid,
          product: line.product,
          fromUnit: line.purchaseUnit,
          quantity,
          unitCost,
          session: s,
        });
        quantity = conv.quantity;
        unitCost = conv.unitCost;
      }

      movementLines.push({
        product: line.product,
        effect: line.stockBucket === "quarantine" ? "out_quarantine" : "out",
        sourceWarehouse: purchaseReturn.warehouse,
        sourceLocation: line.sourceLocation || null,
        quantity,
        requestedUnitCost: unitCost,
        lotNumber: clean(line.lotNumber).toUpperCase(),
        serialNumbers: Array.isArray(line.serialNumbers) ? line.serialNumbers : [],
        note: `Purchase return ${purchaseReturn.returnNo}: ${line.reasonCode || ""}`,
      });
    }

    if (!movementLines.length) return null;

    return postStockMovement({
      tenantId: tid,
      movementType: "purchase_return",
      reference: purchaseReturn.returnNo,
      sourceType: "purchase_return",
      sourceId: purchaseReturn._id,
      idempotencyKey: movementKey,
      currency: purchaseReturn.currency,
      reason: `Purchase return ${purchaseReturn.returnNo}`,
      notes: `System-generated stock movement for ${purchaseReturn.returnNo}.`,
      lines: movementLines,
      userId,
      session: s,
    });
  });
};

/**
 * Reverse Purchase Return stock movement.
 */
export const reversePurchaseReturnStock = async ({
  tenantId,
  purchaseReturn,
  reason = "",
  userId = null,
  session = null,
}) => {
  const tid = requireTenant(tenantId || purchaseReturn.tenantId);
  if (!purchaseReturn.movement) return null;
  return reverseStockMovement({
    tenantId: tid,
    movementId: purchaseReturn.movement,
    reason,
    userId,
    session,
  });
};

/**
 * Stamp cycle count / physical count audit date on ProductStock positions.
 */
export const updateCountAudit = async ({
  tenantId,
  positions = [],
  countedAt = new Date(),
  userId = null,
  session = null,
}) => {
  const tid = requireTenant(tenantId);
  return executeInSession(session, async (s) => {
    for (const pos of positions) {
      if (!pos.product || !pos.warehouse) continue;
      await ProductStock.updateOne(
        {
          tenantId: tid,
          product: pos.product,
          warehouse: pos.warehouse,
          location: pos.location || null,
        },
        {
          $set: {
            lastCountedAt: countedAt,
            updatedBy: userId,
          },
        },
        { session: s }
      );
    }
  });
};

/**
 * Post Stock Adjustment:
 * Creates movement for non-zero variance lines and updates lastCountedAt on ALL counted positions.
 */
export const postStockAdjustmentMovement = async ({
  tenantId,
  adjustment,
  userId = null,
  session = null,
}) => {
  const tid = requireTenant(tenantId || adjustment.tenantId);
  return executeInSession(session, async (s) => {
    const movementLines = adjustment.lines
      .filter((line) => Number(line.varianceQuantity || 0) !== 0)
      .map((line) => {
        const increase = Number(line.varianceQuantity) > 0;
        return {
          product: line.product,
          effect: increase ? "in" : "out",
          sourceWarehouse: increase ? null : adjustment.warehouse,
          sourceLocation: increase ? null : line.location || null,
          destinationWarehouse: increase ? adjustment.warehouse : null,
          destinationLocation: increase ? line.location || null : null,
          quantity: Math.abs(Number(line.varianceQuantity)),
          requestedUnitCost: line.unitCost,
          lotNumber: line.lotNumber,
          serialNumbers: line.serialNumbers,
          note: line.note || `Adjustment ${adjustment.adjustmentNo}`,
        };
      });

    let movement = null;
    if (movementLines.length > 0) {
      movement = await postStockMovement({
        tenantId: tid,
        movementType: "stock_adjustment",
        reference: adjustment.adjustmentNo,
        sourceType: "stock_adjustment",
        sourceId: adjustment._id,
        idempotencyKey: `stock-adjustment:${adjustment._id}`,
        currency: adjustment.currency,
        reason: adjustment.reason || `Stock adjustment ${adjustment.adjustmentNo}`,
        notes: adjustment.notes,
        lines: movementLines,
        userId,
        session: s,
      });
    }

    // Always stamp lastCountedAt on ALL counted positions (including zero variance lines)
    const positions = adjustment.lines.map((line) => ({
      product: line.product,
      warehouse: adjustment.warehouse,
      location: line.location || null,
    }));
    await updateCountAudit({
      tenantId: tid,
      positions,
      countedAt: adjustment.adjustmentDate,
      userId,
      session: s,
    });

    return movement;
  });
};

/**
 * Reverse Stock Adjustment movement.
 */
export const reverseStockAdjustmentMovement = async ({
  tenantId,
  adjustment,
  reason = "",
  userId = null,
  session = null,
}) => {
  const tid = requireTenant(tenantId || adjustment.tenantId);
  if (!adjustment.movement) return null;
  return reverseStockMovement({
    tenantId: tid,
    movementId: adjustment.movement,
    reason,
    userId,
    session,
  });
};

/**
 * Dispatch Stock Transfer:
 * Deducts from sourceWarehouse, adds incoming commitment to destinationWarehouse.
 */
export const dispatchTransferStock = async ({
  tenantId,
  transfer,
  userId = null,
  session = null,
}) => {
  const tid = requireTenant(tenantId || transfer.tenantId);
  return executeInSession(session, async (s) => {
    const movementLines = [];
    for (const line of transfer.lines) {
      movementLines.push({
        product: line.product,
        effect: "out",
        sourceWarehouse: transfer.sourceWarehouse,
        sourceLocation: line.sourceLocation,
        quantity: line.approvedQuantity,
        requestedUnitCost: line.unitCost,
        lotNumber: line.lotNumber,
        serialNumbers: line.serialNumbers,
        manufactureDate: line.manufactureDate,
        expiryDate: line.expiryDate,
        note: line.note,
      });
      movementLines.push({
        product: line.product,
        effect: "incoming",
        destinationWarehouse: transfer.destinationWarehouse,
        destinationLocation: line.destinationLocation,
        quantity: line.approvedQuantity,
        requestedUnitCost: line.unitCost,
        lotNumber: line.lotNumber,
        note: `Incoming transfer commitment for ${transfer.transferNo}.`,
      });
    }

    return postStockMovement({
      tenantId: tid,
      movementType: "warehouse_transfer",
      reference: transfer.transferNo,
      sourceType: "stock_transfer",
      sourceId: transfer._id,
      idempotencyKey: `stock-transfer:${transfer._id}:dispatch`,
      notes: `Dispatch for two-step stock transfer ${transfer.transferNo}.`,
      lines: movementLines,
      userId,
      session: s,
    });
  });
};

/**
 * Receive Stock Transfer:
 * Clears incoming commitment and adds physical on-hand stock at destinationWarehouse.
 */
export const receiveTransferStock = async ({
  tenantId,
  transfer,
  movementLines,
  idempotencyKey,
  userId = null,
  session = null,
}) => {
  const tid = requireTenant(tenantId || transfer.tenantId);
  return executeInSession(session, async (s) => {
    return postStockMovement({
      tenantId: tid,
      movementType: "warehouse_transfer",
      reference: transfer.transferNo,
      sourceType: "stock_transfer",
      sourceId: transfer._id,
      idempotencyKey,
      notes: `Receipt for stock transfer ${transfer.transferNo}.`,
      lines: movementLines,
      userId,
      session: s,
    });
  });
};

/**
 * Direct Stock Transfer:
 * Atomically transfers from sourceWarehouse to destinationWarehouse.
 */
export const postDirectTransferStock = async ({
  tenantId,
  transfer,
  userId = null,
  session = null,
}) => {
  const tid = requireTenant(tenantId || transfer.tenantId);
  return executeInSession(session, async (s) => {
    const lines = transfer.lines.map((line) => ({
      product: line.product,
      effect: "transfer",
      sourceWarehouse: transfer.sourceWarehouse,
      sourceLocation: line.sourceLocation,
      destinationWarehouse: transfer.destinationWarehouse,
      destinationLocation: line.destinationLocation,
      quantity: line.approvedQuantity,
      requestedUnitCost: line.unitCost,
      lotNumber: line.lotNumber,
      serialNumbers: line.serialNumbers,
      manufactureDate: line.manufactureDate,
      expiryDate: line.expiryDate,
      note: line.note,
    }));

    return postStockMovement({
      tenantId: tid,
      movementType: "warehouse_transfer",
      reference: transfer.transferNo,
      sourceType: "stock_transfer",
      sourceId: transfer._id,
      idempotencyKey: `stock-transfer:${transfer._id}:direct`,
      notes: `Direct stock transfer ${transfer.transferNo}.`,
      lines,
      userId,
      session: s,
    });
  });
};

/**
 * Close Short Stock Transfer:
 * Clears remaining incoming quantity commitment and records an InventoryLoss for each shortage.
 */
export const closeShortTransferStock = async ({
  tenantId,
  transfer,
  reason = "",
  userId = null,
  session = null,
}) => {
  const tid = requireTenant(tenantId || transfer.tenantId);
  return executeInSession(session, async (s) => {
    const movementLines = [];
    const shortageLines = [];

    for (const line of transfer.lines) {
      const remaining = roundQuantity(
        line.dispatchedQuantity - line.receivedQuantity - line.shortQuantity
      );
      if (remaining <= 0) continue;

      movementLines.push({
        product: line.product,
        effect: "incoming_clear",
        destinationWarehouse: transfer.destinationWarehouse,
        destinationLocation: line.destinationLocation,
        quantity: remaining,
        requestedUnitCost: line.unitCost,
        lotNumber: line.lotNumber,
        note: `Transfer shortage close for ${transfer.transferNo}.`,
      });

      shortageLines.push({
        product: line.product,
        warehouse: transfer.destinationWarehouse,
        location: line.destinationLocation,
        remaining,
        unitCost: line.unitCost,
      });
    }

    if (!movementLines.length) {
      throw Object.assign(new Error("This transfer has no remaining in-transit quantity."), {
        statusCode: 409,
      });
    }

    const movement = await postStockMovement({
      tenantId: tid,
      movementType: "warehouse_transfer",
      reference: transfer.transferNo,
      sourceType: "stock_transfer",
      sourceId: transfer._id,
      idempotencyKey: `stock-transfer:${transfer._id}:close-short`,
      notes: `Close remaining incoming quantity as shortage: ${reason}`,
      lines: movementLines,
      userId,
      session: s,
    });

    // Record InventoryLoss for each shortage item
    for (const item of shortageLines) {
      const datePart = new Date().toISOString().slice(0, 10).replaceAll("-", "");
      const lossRef = `LOS-${datePart}-${new mongoose.Types.ObjectId().toString().slice(-6).toUpperCase()}`;
      await InventoryLoss.create(
        [
          {
            tenantId: tid,
            lossReference: lossRef,
            product: item.product,
            warehouse: item.warehouse,
            location: item.location || null,
            quantity: item.remaining,
            unitCost: item.unitCost,
            lossValue: roundMoney(item.remaining * item.unitCost),
            lossType: "transfer_shortage",
            reason: clean(reason) || `Transfer shortage for ${transfer.transferNo}`,
            sourceType: "stock_transfer",
            sourceId: transfer._id,
            movement: movement._id,
            journalEntry: movement.journalEntry || null,
            recordedBy: userId,
          },
        ],
        { session: s }
      );
    }

    return movement;
  });
};

/**
 * Post Opening Stock:
 * Routes opening stock balance creation through the centralized posting hub.
 */
export const postOpeningStock = async ({
  tenantId,
  command,
  userId = null,
  session = null,
}) => {
  const tid = requireTenant(tenantId);
  return executeInSession(session, async (s) => {
    const key = {
      tenantId: tid,
      product: command.product,
      warehouse: command.warehouse,
      location: command.location || null,
    };

    const existingStock = await ProductStock.findOne(key).session(s);
    if (existingStock?.status === "archived") {
      throw Object.assign(
        new Error("This stock position is archived. Restore it before adding quantity."),
        { statusCode: 409 }
      );
    }
    if (existingStock?.status === "inactive") {
      existingStock.status = "active";
      existingStock.updatedBy = userId;
      await existingStock.save({ session: s });
    }

    const lines = [
      {
        product: command.product,
        effect: "in",
        destinationWarehouse: command.warehouse,
        destinationLocation: command.location || null,
        quantity: command.quantity,
        requestedUnitCost: command.stockPrice,
        note: "Created from Opening Stock",
      },
    ];

    const movement = await postStockMovement({
      tenantId: tid,
      movementType: "opening_stock",
      reference: `OS-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}`,
      sourceType: "inventory_item",
      sourceId: null,
      idempotencyKey: command.idempotencyKey || undefined,
      currency: "BDT",
      reason: "Inventory Items opening stock",
      lines,
      userId,
      session: s,
    });

    const stock = await ProductStock.findOne(key).session(s);
    return { movement, stock };
  });
};

/**
 * Record stock loss document.
 */
export const recordStockLoss = async ({
  tenantId,
  lossData = {},
  userId = null,
  session = null,
}) => {
  const tid = requireTenant(tenantId);
  return executeInSession(session, async (s) => {
    const [loss] = await InventoryLoss.create(
      [
        {
          ...lossData,
          tenantId: tid,
          recordedBy: userId,
        },
      ],
      { session: s }
    );
    return loss;
  });
};
