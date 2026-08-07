import JournalEntry from "../models/journalEntry.model.js";
import {
  createPostedJournal,
  resolveAccountingAccount,
  roundMoney,
} from "./accountingPosting.service.js";

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

const findOriginalJournal = (sourceType, sourceId, session) =>
  withSession(
    JournalEntry.findOne({
      sourceType,
      sourceId,
      reversalOf: null,
      status: { $in: ["posted", "reversed"] },
    }),
    session
  );

const postProcurementJournal = async ({
  document,
  sourceType,
  date,
  reference,
  totalField,
  debitField,
  debitCode,
  creditField,
  creditCode,
  memo,
  userId,
  session,
}) => {
  const existing = await findOriginalJournal(sourceType, document._id, session);
  if (existing) return existing;

  const amount = documentValue(document, totalField);
  if (amount <= 0) return null;

  const [debitAccount, creditAccount] = await Promise.all([
    resolveAccountingAccount(debitField, debitCode, session),
    resolveAccountingAccount(creditField, creditCode, session),
  ]);

  return createPostedJournal({
    date,
    sourceType,
    sourceId: document._id,
    voucherType: "purchase",
    reference,
    memo,
    currency: document.currency || "BDT",
    userId,
    session,
    lines: [
      { account: debitAccount._id, debit: amount, credit: 0, description: memo },
      { account: creditAccount._id, debit: 0, credit: amount, description: memo },
    ],
  });
};

export const postGoodsReceiptAccounting = (options) =>
  postProcurementJournal({
    ...options,
    sourceType: "goods_receipt",
    date: options.document.receiptDate,
    reference: options.document.receiptNo,
    totalField: "totalAcceptedValue",
    debitField: "inventoryAccount",
    debitCode: "1300",
    creditField: "inventoryClearingAccount",
    creditCode: "2050",
    memo: `Inventory received under ${options.document.receiptNo}`,
  });

export const postPurchaseReturnAccounting = (options) =>
  postProcurementJournal({
    ...options,
    sourceType: "purchase_return",
    date: options.document.returnDate,
    reference: options.document.returnNo,
    totalField: "totalReturnValue",
    debitField: "inventoryClearingAccount",
    debitCode: "2050",
    creditField: "inventoryAccount",
    creditCode: "1300",
    memo: `Inventory returned under ${options.document.returnNo}`,
  });

export const postInventoryAdjustmentAccounting = async ({ document, userId, session }) => {
  const existing = await findOriginalJournal("inventory_adjustment", document._id, session);
  if (existing) return existing;
  const increase = roundMoney(document.increaseValue);
  const decrease = roundMoney(document.decreaseValue);
  if (increase <= 0 && decrease <= 0) return null;
  const [inventoryAccount, adjustmentAccount] = await Promise.all([
    resolveAccountingAccount("inventoryAccount", "1300", session),
    resolveAccountingAccount("inventoryAdjustmentAccount", "5040", session),
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
    date: document.adjustmentDate,
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
    date,
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
