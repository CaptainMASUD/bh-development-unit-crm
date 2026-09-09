import JournalEntry from "../../models/journalEntry.model.js";
import Product from "../../models/inventory/product.model.js";
import {
  createPostedJournal,
  resolveAccountingAccount,
  roundMoney,
} from "../../services/accountingPosting.service.js";

const withSession = (query, session) => (session ? query.session(session) : query);
const saveOptions = (session) => (session ? { session } : undefined);

const documentValue = (document, totalField) => {
  const stored = Number(document?.[totalField] || 0);
  if (stored > 0) return roundMoney(stored);
  return roundMoney(
    (document?.lines || []).reduce(
      (sum, line) => sum + Number(line?.lineValue || 0),
      0
    )
  );
};

const findOriginalJournal = (sourceType, sourceId, session, tenantId = null) =>
  withSession(
    JournalEntry.findOne({
      sourceType,
      sourceId,
      reversalOf: null,
      status: { $in: ["posted", "reversed"] },
      ...(tenantId ? { tenantId } : {}),
    }),
    session
  );

export const postGoodsReceiptAccounting = async ({ document, userId, session }) => {
  const tenantId = document?.tenantId || null;
  const existing = await findOriginalJournal("goods_receipt", document._id, session, tenantId);
  if (existing) return existing;

  const totalAcceptedValue = documentValue(document, "totalAcceptedValue");
  if (totalAcceptedValue <= 0) return null;

  const [inventoryAccount, grniAccount, ppvAccount] = await Promise.all([
    resolveAccountingAccount({ tenantId, settingsField: "inventoryAccount", fallbackCode: "1300", session }),
    resolveAccountingAccount({ tenantId, settingsField: "inventoryClearingAccount", fallbackCode: "2050", session }),
    resolveAccountingAccount({ tenantId, settingsField: "purchasePriceVarianceAccount", fallbackCode: "5030", session }),
  ]);

  // Check lines for standard costing products to calculate PPV
  const lines = document.lines || [];
  let totalStandardValue = 0;
  let hasStandardCosting = false;
  let totalPpv = 0;

  for (const line of lines) {
    const qty = Number(line.acceptedQuantity || line.receivedQuantity || 0);
    const lineCost = Number(line.unitCost || 0);
    const lineVal = roundMoney(qty * lineCost);

    if (line.product) {
      const prod = await withSession(
        Product.findById(line.product).select("costingMethod standardCost"),
        session
      );
      if (prod?.costingMethod === "standard") {
        hasStandardCosting = true;
        const stdCost = Number(prod.standardCost || 0);
        const stdVal = roundMoney(qty * stdCost);
        totalStandardValue = roundMoney(totalStandardValue + stdVal);
        totalPpv = roundMoney(totalPpv + (lineVal - stdVal));
      } else {
        totalStandardValue = roundMoney(totalStandardValue + lineVal);
      }
    } else {
      totalStandardValue = roundMoney(totalStandardValue + lineVal);
    }
  }

  const memo = `Inventory received under ${document.receiptNo}`;
  const journalLines = [];

  if (hasStandardCosting && Math.abs(totalPpv) > 0.001) {
    journalLines.push({
      account: inventoryAccount._id,
      debit: totalStandardValue,
      credit: 0,
      description: memo,
    });
    if (totalPpv > 0) {
      journalLines.push({
        account: ppvAccount._id,
        debit: totalPpv,
        credit: 0,
        description: `PPV debit: ${document.receiptNo}`,
      });
    } else {
      journalLines.push({
        account: ppvAccount._id,
        debit: 0,
        credit: Math.abs(totalPpv),
        description: `PPV credit: ${document.receiptNo}`,
      });
    }
    journalLines.push({
      account: grniAccount._id,
      debit: 0,
      credit: totalAcceptedValue,
      description: memo,
    });
  } else {
    journalLines.push(
      { account: inventoryAccount._id, debit: totalAcceptedValue, credit: 0, description: memo },
      { account: grniAccount._id, debit: 0, credit: totalAcceptedValue, description: memo }
    );
  }

  return createPostedJournal({
    tenantId,
    date: document.receiptDate || new Date(),
    sourceType: "goods_receipt",
    sourceId: document._id,
    voucherType: "purchase",
    reference: document.receiptNo,
    memo,
    currency: document.currency || "BDT",
    userId,
    session,
    lines: journalLines,
  });
};

export const postPurchaseReturnAccounting = async ({ document, userId, session }) => {
  const tenantId = document?.tenantId || null;
  const existing = await findOriginalJournal("purchase_return", document._id, session, tenantId);
  if (existing) return existing;

  const amount = documentValue(document, "totalReturnValue");
  if (amount <= 0) return null;

  const [grniAccount, inventoryAccount] = await Promise.all([
    resolveAccountingAccount({ tenantId, settingsField: "inventoryClearingAccount", fallbackCode: "2050", session }),
    resolveAccountingAccount({ tenantId, settingsField: "inventoryAccount", fallbackCode: "1300", session }),
  ]);

  const memo = `Inventory returned under ${document.returnNo}`;
  return createPostedJournal({
    tenantId,
    date: document.returnDate || new Date(),
    sourceType: "purchase_return",
    sourceId: document._id,
    voucherType: "purchase",
    reference: document.returnNo,
    memo,
    currency: document.currency || "BDT",
    userId,
    session,
    lines: [
      { account: grniAccount._id, debit: amount, credit: 0, description: memo },
      { account: inventoryAccount._id, debit: 0, credit: amount, description: memo },
    ],
  });
};

export const postInventoryAdjustmentAccounting = async ({ document, userId, session }) => {
  const tenantId = document?.tenantId || null;
  const existing = await findOriginalJournal("inventory_adjustment", document._id, session, tenantId);
  if (existing) return existing;

  const increase = roundMoney(document.increaseValue);
  const decrease = roundMoney(document.decreaseValue);
  if (increase <= 0 && decrease <= 0) return null;

  const [inventoryAccount, adjustmentAccount] = await Promise.all([
    resolveAccountingAccount({ tenantId, settingsField: "inventoryAccount", fallbackCode: "1300", session }),
    resolveAccountingAccount({ tenantId, settingsField: "inventoryAdjustmentAccount", fallbackCode: "5040", session }),
  ]);

  const lines = [];
  if (increase > 0) {
    lines.push(
      { account: inventoryAccount._id, debit: increase, credit: 0, description: `Inventory gain - ${document.adjustmentNo}` },
      { account: adjustmentAccount._id, debit: 0, credit: increase, description: `Inventory gain - ${document.adjustmentNo}` }
    );
  }
  if (decrease > 0) {
    lines.push(
      { account: adjustmentAccount._id, debit: decrease, credit: 0, description: `Inventory loss - ${document.adjustmentNo}` },
      { account: inventoryAccount._id, debit: 0, credit: decrease, description: `Inventory loss - ${document.adjustmentNo}` }
    );
  }

  return createPostedJournal({
    tenantId,
    date: document.adjustmentDate || new Date(),
    sourceType: "inventory_adjustment",
    sourceId: document._id,
    voucherType: "adjustment",
    reference: document.adjustmentNo,
    memo: document.reason || `Inventory adjustment ${document.adjustmentNo}`,
    currency: document.currency || "BDT",
    userId,
    session,
    lines,
  });
};

export const reverseProcurementAccounting = async ({
  sourceType,
  sourceId,
  date,
  reference,
  reason,
  userId,
  session,
}) => {
  const original = await findOriginalJournal(sourceType, sourceId, session);
  if (!original) return null;
  if (original.status === "reversed") {
    return withSession(JournalEntry.findById(original.reversedByEntry), session);
  }

  const priorReversal = await withSession(
    JournalEntry.findOne({ reversalOf: original._id }),
    session
  );
  if (priorReversal) return priorReversal;

  const reversal = await createPostedJournal({
    tenantId: original.tenantId,
    date: date || new Date(),
    sourceType,
    sourceId,
    voucherType: original.voucherType,
    reference: reference || `REV-${original.entryNo}`,
    memo: reason || `Reversal of ${original.entryNo}`,
    currency: original.currency,
    userId,
    session,
    lines: original.lines.map((line) => ({
      account: line.account,
      debit: line.credit,
      credit: line.debit,
      description: `Reversal: ${line.description || original.memo}`,
      contactType: line.contactType,
      contactId: line.contactId,
      costCenter: line.costCenter,
      project: line.project,
      taxCode: line.taxCode,
    })),
  });

  reversal.reversalOf = original._id;
  reversal.reversalReason = reason;
  await reversal.save(saveOptions(session));

  original.status = "reversed";
  original.reversedAt = new Date();
  original.reversedBy = userId;
  original.reversedByEntry = reversal._id;
  original.reversalReason = reason;
  await original.save(saveOptions(session));
  return reversal;
};
