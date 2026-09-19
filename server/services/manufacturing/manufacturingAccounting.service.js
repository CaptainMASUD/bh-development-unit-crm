import { createPostedJournal, resolveAccountingAccount, roundMoney } from "../accounting/accountingPosting.service.js";
import { resolveInventoryAssetAccount } from "../inventory/inventoryAccounting.service.js";

const resolveWip = ({ tenantId, session }) => resolveAccountingAccount({ tenantId, settingsField: "workInProgressAccount", fallbackCode: "1320", session });

export const postManufacturingIssueJournal = async ({ tenantId, movement, userId = null, session = null }) => {
  const wip = await resolveWip({ tenantId, session });
  const lines = [];
  for (const item of movement.lines || []) {
    const value = roundMoney(item.appliedValue || 0);
    if (value <= 0) continue;
    const asset = await resolveInventoryAssetAccount({ tenantId, productId: item.product, warehouseId: item.sourceWarehouse, session });
    lines.push({ account: wip._id, debit: value, credit: 0, description: `Production WIP issue ${movement.movementNo}` });
    lines.push({ account: asset, debit: 0, credit: value, description: `Raw material issue ${movement.movementNo}` });
  }
  if (!lines.length) return null;
  return createPostedJournal({ tenantId, inventoryMovement: movement._id, date: movement.movementDate, lines, sourceType: "manufacturing_issue", sourceId: movement.sourceId || movement._id, reference: movement.reference, memo: `Manufacturing material issue ${movement.movementNo}`, origin: "system", userId, session });
};

export const postManufacturingReceiptJournal = async ({ tenantId, movement, userId = null, session = null }) => {
  const wip = await resolveWip({ tenantId, session });
  const lines = [];
  for (const item of movement.lines || []) {
    const value = roundMoney(item.appliedValue || 0);
    if (value <= 0) continue;
    const asset = await resolveInventoryAssetAccount({ tenantId, productId: item.product, warehouseId: item.destinationWarehouse, session });
    lines.push({ account: asset, debit: value, credit: 0, description: `Finished goods receipt ${movement.movementNo}` });
    lines.push({ account: wip._id, debit: 0, credit: value, description: `Production WIP relief ${movement.movementNo}` });
  }
  if (!lines.length) return null;
  return createPostedJournal({ tenantId, inventoryMovement: movement._id, date: movement.movementDate, lines, sourceType: "manufacturing_receipt", sourceId: movement.sourceId || movement._id, reference: movement.reference, memo: `Manufacturing finished goods receipt ${movement.movementNo}`, origin: "system", userId, session });
};
