import mongoose from "mongoose";
import {
  createPostedJournal,
  createReversalJournal,
  resolveAccountingAccount,
  roundMoney,
} from "../../services/accountingPosting.service.js";
import Product from "../../models/inventory/product.model.js";
import Warehouse from "../../models/inventory/warehouse.model.js";
import Department from "../../models/department.model.js";

/**
 * Resolves the inventory asset account for a product and warehouse.
 * Precedence: product.inventoryAccount -> warehouse.inventoryAccount -> settings.inventoryAccount -> fallback 1300
 */
export const resolveInventoryAssetAccount = async ({
  tenantId,
  productId = null,
  warehouseId = null,
  session = null,
}) => {
  if (productId) {
    const productQuery = Product.findById(productId).select("inventoryAccount");
    if (session) productQuery.session(session);
    const prod = await productQuery.lean();
    if (prod?.inventoryAccount) {
      return prod.inventoryAccount;
    }
  }

  if (warehouseId) {
    const warehouseQuery = Warehouse.findById(warehouseId).select("inventoryAccount");
    if (session) warehouseQuery.session(session);
    const wh = await warehouseQuery.lean();
    if (wh?.inventoryAccount) {
      return wh.inventoryAccount;
    }
  }

  const account = await resolveAccountingAccount({
    tenantId,
    settingsField: "inventoryAccount",
    fallbackCode: "1300",
    session,
  });
  return account._id;
};

/**
 * Resolves COGS account.
 * Precedence: product.cogsAccount -> settings.cogsAccount -> fallback 5020
 */
export const resolveCogsAccount = async ({
  tenantId,
  productId = null,
  session = null,
}) => {
  if (productId) {
    const prodQuery = Product.findById(productId).select("cogsAccount");
    if (session) prodQuery.session(session);
    const prod = await prodQuery.lean();
    if (prod?.cogsAccount) return prod.cogsAccount;
  }
  const account = await resolveAccountingAccount({
    tenantId,
    settingsField: "cogsAccount",
    fallbackCode: "5020",
    session,
  });
  return account._id;
};

/**
 * Resolves expense account for internal consumption.
 * Precedence: department.expenseAccount -> product.expenseAccount -> settings.inventoryConsumptionAccount -> fallback 5080
 */
export const resolveConsumptionAccount = async ({
  tenantId,
  departmentId = null,
  productId = null,
  session = null,
}) => {
  if (departmentId) {
    const deptQuery = Department.findById(departmentId).select("expenseAccount");
    if (session) deptQuery.session(session);
    const dept = await deptQuery.lean();
    if (dept?.expenseAccount) return dept.expenseAccount;
  }
  if (productId) {
    const prodQuery = Product.findById(productId).select("expenseAccount");
    if (session) prodQuery.session(session);
    const prod = await prodQuery.lean();
    if (prod?.expenseAccount) return prod.expenseAccount;
  }
  const account = await resolveAccountingAccount({
    tenantId,
    settingsField: "inventoryConsumptionAccount",
    fallbackCode: "5080",
    session,
  });
  return account._id;
};

/**
 * Creates GL journal entry for an inventory stock movement atomically.
 */
export const postInventoryMovementJournal = async ({
  movement,
  linesWithCosting,
  userId = null,
  session = null,
}) => {
  if (!movement || !Array.isArray(linesWithCosting) || linesWithCosting.length === 0) {
    return null;
  }

  const tenantId = movement.tenantId;
  const movementType = movement.movementType;
  const movementDate = movement.movementDate || new Date();
  const movementNo = movement.movementNo;

  // If movement is already posted to GL, avoid double posting
  if (movement.journalEntry) {
    return movement.journalEntry;
  }

  const journalLines = [];

  // Group line values by account to keep journals clean and consolidated
  const debitMap = new Map();
  const creditMap = new Map();

  const addDebit = (accountId, amount, description = "") => {
    const id = String(accountId);
    const prev = debitMap.get(id) || { amount: 0, description };
    prev.amount = roundMoney(prev.amount + amount);
    debitMap.set(id, prev);
  };

  const addCredit = (accountId, amount, description = "") => {
    const id = String(accountId);
    const prev = creditMap.get(id) || { amount: 0, description };
    prev.amount = roundMoney(prev.amount + amount);
    creditMap.set(id, prev);
  };

  if (movementType === "opening_stock") {
    const equityAccount = (
      await resolveAccountingAccount({
        tenantId,
        settingsField: "openingBalanceAccount",
        fallbackCode: "3100",
        session,
      })
    )._id;

    for (const line of linesWithCosting) {
      const lineVal = roundMoney(line.appliedValue);
      if (lineVal <= 0) continue;
      const assetAccount = await resolveInventoryAssetAccount({
        tenantId,
        productId: line.product,
        warehouseId: line.destinationWarehouse,
        session,
      });
      addDebit(assetAccount, lineVal, `Opening stock: ${movementNo}`);
      addCredit(equityAccount, lineVal, `Opening balance offset: ${movementNo}`);
    }
  } else if (movementType === "purchase_receipt") {
    const grniAccount = (
      await resolveAccountingAccount({
        tenantId,
        settingsField: "inventoryClearingAccount",
        fallbackCode: "2050",
        session,
      })
    )._id;

    const ppvAccount = (
      await resolveAccountingAccount({
        tenantId,
        settingsField: "purchasePriceVarianceAccount",
        fallbackCode: "5030",
        session,
      })
    )._id;

    for (const line of linesWithCosting) {
      const lineVal = roundMoney(line.appliedValue); // value added to inventory
      const variance = roundMoney(line.varianceAmount || 0); // PPV
      const actualCostValue = roundMoney(lineVal + variance); // GRNI credit

      const assetAccount = await resolveInventoryAssetAccount({
        tenantId,
        productId: line.product,
        warehouseId: line.destinationWarehouse,
        session,
      });

      addDebit(assetAccount, lineVal, `Goods receipt: ${movementNo}`);
      if (variance > 0) {
        // Actual cost > standard cost -> PPV expense debit
        addDebit(ppvAccount, variance, `PPV debit: ${movementNo}`);
      } else if (variance < 0) {
        // Actual cost < standard cost -> PPV income credit
        addCredit(ppvAccount, Math.abs(variance), `PPV credit: ${movementNo}`);
      }
      addCredit(grniAccount, actualCostValue, `GRNI receipt: ${movementNo}`);
    }
  } else if (movementType === "purchase_return") {
    const grniAccount = (
      await resolveAccountingAccount({
        tenantId,
        settingsField: "inventoryClearingAccount",
        fallbackCode: "2050",
        session,
      })
    )._id;

    for (const line of linesWithCosting) {
      const lineVal = roundMoney(line.appliedValue);
      if (lineVal <= 0) continue;
      const assetAccount = await resolveInventoryAssetAccount({
        tenantId,
        productId: line.product,
        warehouseId: line.sourceWarehouse,
        session,
      });
      addDebit(grniAccount, lineVal, `Purchase return GRNI debit: ${movementNo}`);
      addCredit(assetAccount, lineVal, `Inventory return credit: ${movementNo}`);
    }
  } else if (movementType === "sales_issue") {
    for (const line of linesWithCosting) {
      const lineVal = roundMoney(line.appliedValue);
      if (lineVal <= 0) continue;
      const cogsAccount = await resolveCogsAccount({
        tenantId,
        productId: line.product,
        session,
      });
      const assetAccount = await resolveInventoryAssetAccount({
        tenantId,
        productId: line.product,
        warehouseId: line.sourceWarehouse,
        session,
      });
      addDebit(cogsAccount, lineVal, `COGS for sales delivery: ${movementNo}`);
      addCredit(assetAccount, lineVal, `Inventory relief for sales delivery: ${movementNo}`);
    }
  } else if (movementType === "sales_return") {
    for (const line of linesWithCosting) {
      const lineVal = roundMoney(line.appliedValue);
      if (lineVal <= 0) continue;
      const cogsAccount = await resolveCogsAccount({
        tenantId,
        productId: line.product,
        session,
      });
      const assetAccount = await resolveInventoryAssetAccount({
        tenantId,
        productId: line.product,
        warehouseId: line.destinationWarehouse,
        session,
      });
      addDebit(assetAccount, lineVal, `Inventory restoration from customer return: ${movementNo}`);
      addCredit(cogsAccount, lineVal, `COGS reversal from customer return: ${movementNo}`);
    }
  } else if (movementType === "stock_adjustment") {
    const adjustmentAccount = (
      await resolveAccountingAccount({
        tenantId,
        settingsField: "inventoryAdjustmentAccount",
        fallbackCode: "5040",
        session,
      })
    )._id;

    for (const line of linesWithCosting) {
      const lineVal = roundMoney(line.appliedValue);
      if (lineVal <= 0) continue;
      const isIncrease = line.effect === "in";
      const whId = isIncrease ? line.destinationWarehouse : line.sourceWarehouse;
      const assetAccount = await resolveInventoryAssetAccount({
        tenantId,
        productId: line.product,
        warehouseId: whId,
        session,
      });

      if (isIncrease) {
        addDebit(assetAccount, lineVal, `Stock adjustment gain: ${movementNo}`);
        addCredit(adjustmentAccount, lineVal, `Stock adjustment gain offset: ${movementNo}`);
      } else {
        addDebit(adjustmentAccount, lineVal, `Stock adjustment loss offset: ${movementNo}`);
        addCredit(assetAccount, lineVal, `Stock adjustment loss: ${movementNo}`);
      }
    }
  } else if (movementType === "warehouse_transfer") {
    const inTransitAccount = (
      await resolveAccountingAccount({
        tenantId,
        settingsField: "inventoryInTransitAccount",
        fallbackCode: "1310",
        session,
      })
    )._id;

    for (const line of linesWithCosting) {
      const lineVal = roundMoney(line.appliedValue);
      if (lineVal <= 0) continue;

      if (line.sourceWarehouse && line.destinationWarehouse) {
        // Direct warehouse to warehouse transfer
        const sourceAsset = await resolveInventoryAssetAccount({
          tenantId,
          productId: line.product,
          warehouseId: line.sourceWarehouse,
          session,
        });
        const destAsset = await resolveInventoryAssetAccount({
          tenantId,
          productId: line.product,
          warehouseId: line.destinationWarehouse,
          session,
        });

        // Only create GL movement if source and destination asset accounts differ
        if (String(sourceAsset) !== String(destAsset)) {
          addDebit(destAsset, lineVal, `Transfer receipt: ${movementNo}`);
          addCredit(sourceAsset, lineVal, `Transfer dispatch: ${movementNo}`);
        }
      } else if (line.sourceWarehouse && !line.destinationWarehouse) {
        // Dispatch into In-Transit
        const sourceAsset = await resolveInventoryAssetAccount({
          tenantId,
          productId: line.product,
          warehouseId: line.sourceWarehouse,
          session,
        });
        addDebit(inTransitAccount, lineVal, `Transfer dispatch to in-transit: ${movementNo}`);
        addCredit(sourceAsset, lineVal, `Transfer dispatch source relief: ${movementNo}`);
      } else if (!line.sourceWarehouse && line.destinationWarehouse) {
        // Receipt from In-Transit
        const destAsset = await resolveInventoryAssetAccount({
          tenantId,
          productId: line.product,
          warehouseId: line.destinationWarehouse,
          session,
        });
        addDebit(destAsset, lineVal, `Transfer receipt from in-transit: ${movementNo}`);
        addCredit(inTransitAccount, lineVal, `In-transit relief: ${movementNo}`);
      }
    }
  } else {
    // Other operational movements (production issue, etc.)
    return null;
  }

  // Construct balanced journal lines
  for (const [accId, { amount, description }] of debitMap.entries()) {
    if (amount > 0) {
      journalLines.push({
        account: accId,
        debit: amount,
        credit: 0,
        description,
      });
    }
  }

  for (const [accId, { amount, description }] of creditMap.entries()) {
    if (amount > 0) {
      journalLines.push({
        account: accId,
        debit: 0,
        credit: amount,
        description,
      });
    }
  }

  if (journalLines.length < 2) {
    return null;
  }

  const journal = await createPostedJournal({
    tenantId,
    inventoryMovement: movement._id,
    date: movementDate,
    lines: journalLines,
    sourceType:
      movementType === "sales_issue"
        ? "sales_delivery"
        : movementType === "sales_return"
        ? "sales_return"
        : movementType === "purchase_receipt"
        ? "goods_receipt"
        : movementType === "purchase_return"
        ? "purchase_return"
        : movementType === "opening_stock"
        ? "opening_stock"
        : movementType === "warehouse_transfer"
        ? "inventory_transfer"
        : "inventory_adjustment",
    sourceId: movement.sourceId || movement._id,
    reference: movement.reference || movementNo,
    memo: `Inventory posting for ${movementType} (${movementNo})`,
    origin: "system",
    userId,
    session,
  });

  return journal;
};

/**
 * Creates GL journal entry for internal inventory consumption.
 */
export const postInternalConsumptionJournal = async ({
  tenantId,
  issueReference,
  productId,
  warehouseId,
  departmentId = null,
  quantity,
  appliedValue,
  date = new Date(),
  userId = null,
  session = null,
}) => {
  const lineVal = roundMoney(appliedValue);
  if (lineVal <= 0) return null;

  const expenseAccount = await resolveConsumptionAccount({
    tenantId,
    departmentId,
    productId,
    session,
  });

  const assetAccount = await resolveInventoryAssetAccount({
    tenantId,
    productId,
    warehouseId,
    session,
  });

  const lines = [
    {
      account: expenseAccount,
      debit: lineVal,
      credit: 0,
      description: `Internal consumption: ${issueReference}`,
    },
    {
      account: assetAccount,
      debit: 0,
      credit: lineVal,
      description: `Inventory relief for consumption: ${issueReference}`,
    },
  ];

  return createPostedJournal({
    tenantId,
    date,
    lines,
    sourceType: "inventory_consumption",
    reference: issueReference,
    memo: `Internal stock consumption: ${issueReference}`,
    origin: "system",
    userId,
    session,
  });
};

/**
 * Creates GL journal entry for inventory loss (damage, expiry, scrap, shrinkage).
 */
export const postInventoryLossJournal = async ({
  tenantId,
  lossReference,
  lossType,
  productId,
  warehouseId,
  quantity,
  lossValue,
  date = new Date(),
  userId = null,
  session = null,
}) => {
  const lineVal = roundMoney(lossValue);
  if (lineVal <= 0) return null;

  let lossAccount;
  if (lossType === "damage") {
    lossAccount = (
      await resolveAccountingAccount({
        tenantId,
        settingsField: "inventoryDamageAccount",
        fallbackCode: "5050",
        session,
      })
    )._id;
  } else if (lossType === "expiry") {
    lossAccount = (
      await resolveAccountingAccount({
        tenantId,
        settingsField: "inventoryExpiryAccount",
        fallbackCode: "5060",
        session,
      })
    )._id;
  } else {
    // scrap, shrinkage, transfer_shortage, inspection, adjustment
    lossAccount = (
      await resolveAccountingAccount({
        tenantId,
        settingsField: "inventoryLossAccount",
        fallbackCode: "5070",
        session,
      })
    )._id;
  }

  const assetAccount = await resolveInventoryAssetAccount({
    tenantId,
    productId,
    warehouseId,
    session,
  });

  const lines = [
    {
      account: lossAccount,
      debit: lineVal,
      credit: 0,
      description: `Stock loss (${lossType}): ${lossReference}`,
    },
    {
      account: assetAccount,
      debit: 0,
      credit: lineVal,
      description: `Inventory reduction for ${lossType}: ${lossReference}`,
    },
  ];

  return createPostedJournal({
    tenantId,
    date,
    lines,
    sourceType: "inventory_loss",
    reference: lossReference,
    memo: `Inventory ${lossType} write-off: ${lossReference}`,
    origin: "system",
    userId,
    session,
  });
};

/**
 * Creates GL journal entry for inventory revaluation (write-up / write-down).
 */
export const postInventoryRevaluationJournal = async ({
  revaluation,
  userId = null,
  session = null,
}) => {
  const tenantId = revaluation.tenantId;
  const valueDifference = roundMoney(revaluation.valueDifference);
  if (valueDifference === 0) return null;

  const revalAccount = (
    await resolveAccountingAccount({
      tenantId,
      settingsField: "inventoryRevaluationAccount",
      fallbackCode: "5090",
      session,
    })
  )._id;

  const assetAccount = await resolveInventoryAssetAccount({
    tenantId,
    productId: revaluation.product,
    warehouseId: revaluation.warehouse,
    session,
  });

  const isWriteUp = valueDifference > 0;
  const absDiff = Math.abs(valueDifference);

  const lines = isWriteUp
    ? [
        {
          account: assetAccount,
          debit: absDiff,
          credit: 0,
          description: `Inventory revaluation write-up: ${revaluation.revaluationNo}`,
        },
        {
          account: revalAccount,
          debit: 0,
          credit: absDiff,
          description: `Revaluation gain: ${revaluation.revaluationNo}`,
        },
      ]
    : [
        {
          account: revalAccount,
          debit: absDiff,
          credit: 0,
          description: `Revaluation loss: ${revaluation.revaluationNo}`,
        },
        {
          account: assetAccount,
          debit: 0,
          credit: absDiff,
          description: `Inventory revaluation write-down: ${revaluation.revaluationNo}`,
        },
      ];

  return createPostedJournal({
    tenantId,
    date: revaluation.revaluationDate || new Date(),
    lines,
    sourceType: "inventory_revaluation",
    sourceId: revaluation._id,
    reference: revaluation.revaluationNo,
    memo: `Stock revaluation: ${revaluation.reason || revaluation.revaluationNo}`,
    origin: "system",
    userId,
    session,
  });
};

/**
 * Handles compensating reversal of movement's journal entry when a movement is reversed.
 */
export const reverseMovementJournal = async ({
  movement,
  reason = "Compensating reversal",
  userId = null,
  session = null,
}) => {
  if (!movement.journalEntry) return null;
  const reversal = await createReversalJournal({
    originalJournalId: movement.journalEntry,
    date: new Date(),
    reason,
    userId,
    session,
  });
  return reversal;
};
