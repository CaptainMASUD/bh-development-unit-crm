import StockMovement from "../../models/inventory/stockMovement.model.js";
import { postStockMovement } from "../inventory/inventoryPosting.service.js";
import { postManufacturingIssueJournal, postManufacturingReceiptJournal } from "./manufacturingAccounting.service.js";

export const issueMaterialsToProduction = async ({ tenantId, issue, userId = null, session = null }) => {
  const movement = await postStockMovement({
    tenantId, movementType: "production_issue", reference: issue.issueNumber, sourceType: "manufacturing_material_issue", sourceId: issue._id,
    idempotencyKey: `manufacturing:issue:${issue._id}`, reason: `Material issue for manufacturing order ${issue.manufacturingOrder}`,
    lines: (issue.lines || []).map(line => ({ product: line.product, effect: "out", sourceWarehouse: line.warehouse, sourceLocation: line.location || null, quantity: line.quantity, lotNumber: line.lotNumber, serialNumbers: line.serialNumbers || [] })),
    userId, session,
  });
  const populated = await StockMovement.findById(movement._id).lean();
  const journal = await postManufacturingIssueJournal({ tenantId, movement: populated, userId, session });
  return { movement, journal };
};

export const receiveFinishedGoods = async ({ tenantId, manufacturingOrder, entry, unitCost = 0, userId = null, session = null }) => {
  if (Number(entry.goodQuantity || 0) <= 0) return { movement: null, journal: null };
  const movement = await postStockMovement({
    tenantId, movementType: "production_receipt", reference: entry.entryNumber, sourceType: "manufacturing_production_entry", sourceId: entry._id,
    idempotencyKey: `manufacturing:receipt:${entry._id}`, reason: `Finished goods receipt for ${manufacturingOrder.moNumber}`,
    lines: [{ product: manufacturingOrder.product, effect: "in", destinationWarehouse: manufacturingOrder.finishedGoodsWarehouse, quantity: entry.goodQuantity, requestedUnitCost: unitCost, lotNumber: entry.batchNumber || "", manufactureDate: entry.manufactureDate, expiryDate: entry.expiryDate }],
    userId, session,
  });
  const populated = await StockMovement.findById(movement._id).lean();
  const journal = await postManufacturingReceiptJournal({ tenantId, movement: populated, userId, session });
  return { movement, journal };
};
